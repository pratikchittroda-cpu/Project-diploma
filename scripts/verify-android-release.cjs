#!/usr/bin/env node
// Static verification only. Never builds, downloads tools, signs, installs, or contacts a service.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash, X509Certificate } = require('node:crypto');
const { inflateRawSync } = require('node:zlib');

const PACKAGE = 'com.nustudent.expenzo';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const LIMITS = Object.freeze({ archive: 512 * 1024 ** 2, entry: 128 * 1024 ** 2,
  expanded: 2 * 1024 ** 3, entries: 20000, xml: 2 * 1024 ** 2, output: 16 * 1024 ** 2 });
const ABIS = Object.freeze({ 'arm64-v8a': [2, 183], 'armeabi-v7a': [1, 40], x86: [1, 3], x86_64: [2, 62] });
const DISALLOWED = new Set([
  'CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
  'MANAGE_EXTERNAL_STORAGE', 'MANAGE_MEDIA', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO', 'READ_MEDIA_VISUAL_USER_SELECTED', 'SYSTEM_ALERT_WINDOW',
].map(name => `android.permission.${name}`));
const DEVICE_GATES = Object.freeze([
  'Generated/Play-delivered APK signatures and zipalign -c -P 16 -v 4 for every APK',
  'Actual 16 KB device/emulator runtime with PAGE_SIZE=16384 and compatibility mode off',
  'Google login and Play Integrity App Check using the actual distribution signing identity',
  'Personal/company account-deletion success, reauthentication, retry and isolation scenarios',
]);

function requireThat(condition, message) { if (!condition) throw new Error(message); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fileHash(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.alloc(1024 * 1024);
  try {
    requireThat(fs.fstatSync(fd).isFile(), 'Hash input must be a regular file');
    let count, total = 0;
    while ((count = fs.readSync(fd, chunk))) {
      total += count; requireThat(total <= LIMITS.archive, 'Hash input exceeds file limit');
      hash.update(chunk.subarray(0, count));
    }
  }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function copySnapshot(source, destination) {
  const input = fs.openSync(source, 'r');
  let output;
  try {
    const stat = fs.fstatSync(input);
    requireThat(stat.isFile() && stat.size > 0 && stat.size <= LIMITS.archive, 'Artifact is not a bounded regular file');
    output = fs.openSync(destination, 'wx', 0o600);
    const chunk = Buffer.alloc(1024 * 1024);
    let count, total = 0;
    while ((count = fs.readSync(input, chunk))) {
      total += count; requireThat(total <= LIMITS.archive, 'Artifact changed or exceeds archive limit');
      let written = 0;
      while (written < count) written += fs.writeSync(output, chunk, written, count - written);
    }
    requireThat(total === stat.size, 'Artifact size changed while copying');
  } finally { fs.closeSync(input); if (output !== undefined) fs.closeSync(output); }
  fs.chmodSync(destination, 0o400);
}
function localFile(value, label, maximum = LIMITS.archive, executable = false) {
  requireThat(typeof value === 'string' && value.length > 0 && !value.includes('\0'), `${label} requires an explicit local path`);
  const file = path.resolve(value);
  const stat = fs.statSync(file);
  requireThat(stat.isFile() && stat.size > 0 && stat.size <= maximum, `${label}: missing, empty, non-regular or oversized file`);
  fs.accessSync(file, executable ? fs.constants.R_OK | fs.constants.X_OK : fs.constants.R_OK);
  return file;
}
function positiveInteger(value, label, maximum = 2100000000) {
  requireThat(typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number(value) <= maximum, `${label} must be an explicit positive decimal integer <= ${maximum}`);
  return Number(value);
}
function expectedAbis(value) {
  requireThat(typeof value === 'string' && value.length > 0, '--expected-abis is required');
  const abis = value.split(',');
  requireThat(new Set(abis).size === abis.length && abis.every(abi => Object.hasOwn(ABIS, abi)) && abis.includes('arm64-v8a'),
    '--expected-abis must be a unique comma-separated supported ABI set including arm64-v8a');
  return abis.sort();
}

// Deliberately small ZIP32 reader. No entry is ever extracted onto the filesystem.
// Unsupported ZIP64, unusual encodings, links and ambiguous layouts fail rather than being skipped.
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function zipName(bytes) {
  requireThat(bytes.length > 0 && bytes.length <= 1024 && bytes.every(byte => byte >= 32 && byte < 127), 'ZIP entry name must be bounded printable ASCII');
  const name = bytes.toString('ascii');
  const segments = name.replace(/\/$/, '').split('/');
  requireThat(!/[\\:]/.test(name) && segments.every(segment => segment && segment !== '.' && segment !== '..'), `Unsafe ZIP entry path: ${name}`);
  return name;
}
function zipExtra(bytes) {
  for (let at = 0; at < bytes.length;) {
    requireThat(at + 4 <= bytes.length, 'Truncated ZIP extra field');
    const id = bytes.readUInt16LE(at), size = bytes.readUInt16LE(at + 2);
    requireThat(id !== 0x0001 && id !== 0x7075, 'ZIP64/alternate Unicode entry paths are unsupported');
    at += 4 + size;
    requireThat(at <= bytes.length, 'Truncated ZIP extra field data');
  }
}
function openZip(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    requireThat(size >= 22 && size <= LIMITS.archive, 'ZIP archive size is invalid');
    const read = (offset, length) => {
      requireThat(Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 && length <= LIMITS.entry && offset + length <= size, 'ZIP read exceeds bounded archive');
      const bytes = Buffer.alloc(length);
      let done = 0;
      while (done < length) {
        const count = fs.readSync(fd, bytes, done, length - done, offset + done);
        requireThat(count > 0, 'Truncated ZIP read'); done += count;
      }
      return bytes;
    };
    const tail = read(Math.max(0, size - 65557), Math.min(size, 65557));
    let end = -1;
    for (let at = tail.length - 22; at >= 0; at--) {
      if (tail.readUInt32LE(at) === 0x06054b50 && at + 22 + tail.readUInt16LE(at + 20) === tail.length) { end = at; break; }
    }
    requireThat(end >= 0, 'ZIP end record missing or trailing data present');
    const eocd = tail.subarray(end), entriesCount = eocd.readUInt16LE(10);
    const directorySize = eocd.readUInt32LE(12), directoryOffset = eocd.readUInt32LE(16);
    requireThat(eocd.readUInt16LE(4) === 0 && eocd.readUInt16LE(6) === 0 && eocd.readUInt16LE(8) === entriesCount && entriesCount > 0 && entriesCount <= LIMITS.entries,
      'Multi-disk/ZIP64 or excessive/empty ZIP entries are unsupported');
    requireThat(directoryOffset + directorySize === size - tail.length + end && directorySize <= 16 * 1024 ** 2, 'Unsupported ZIP central directory layout');
    const directory = read(directoryOffset, directorySize), entries = [], names = new Set();
    let at = 0, total = 0;
    for (let index = 0; index < entriesCount; index++) {
      requireThat(at + 46 <= directory.length && directory.readUInt32LE(at) === 0x02014b50, 'Malformed ZIP central entry');
      const flags = directory.readUInt16LE(at + 8), method = directory.readUInt16LE(at + 10);
      const crc = directory.readUInt32LE(at + 16), compressed = directory.readUInt32LE(at + 20), expanded = directory.readUInt32LE(at + 24);
      const nameSize = directory.readUInt16LE(at + 28), extraSize = directory.readUInt16LE(at + 30), commentSize = directory.readUInt16LE(at + 32);
      const offset = directory.readUInt32LE(at + 42), mode = (directory.readUInt32LE(at + 38) >>> 16) & 0xf000;
      requireThat(at + 46 + nameSize + extraSize + commentSize <= directory.length, 'Truncated ZIP central entry');
      requireThat(directory.readUInt16LE(at + 34) === 0 && !(flags & ~0x080e) && [0, 8].includes(method), 'Encrypted or unsupported ZIP compression/flags');
      requireThat([0, 0x4000, 0x8000].includes(mode), 'ZIP links or special files are forbidden');
      requireThat(compressed <= LIMITS.entry && expanded <= LIMITS.entry && (expanded === 0 || compressed > 0) && expanded <= Math.max(1, compressed) * 2000, 'ZIP entry exceeds size/compression limits');
      total += expanded;
      requireThat(total <= LIMITS.expanded, 'ZIP total expanded size exceeds limit');
      const name = zipName(directory.subarray(at + 46, at + 46 + nameSize));
      requireThat(!names.has(name.toLowerCase()), `Duplicate/ambiguous ZIP entry: ${name}`); names.add(name.toLowerCase());
      requireThat(!name.endsWith('/') || expanded === 0, 'ZIP directory has data');
      requireThat(mode !== 0x4000 || name.endsWith('/'), 'ZIP directory type/name mismatch');
      zipExtra(directory.subarray(at + 46 + nameSize, at + 46 + nameSize + extraSize));
      entries.push({ name, flags, method, crc, compressed, expanded, offset });
      at += 46 + nameSize + extraSize + commentSize;
    }
    requireThat(at === directory.length, 'Unparsed central directory data');
    let previousEnd = 0;
    for (const entry of [...entries].sort((a, b) => a.offset - b.offset)) {
      requireThat(entry.offset === previousEnd, 'ZIP overlapping entries, gaps or prepended data');
      const local = read(entry.offset, 30);
      requireThat(local.readUInt32LE(0) === 0x04034b50 && local.readUInt16LE(6) === entry.flags && local.readUInt16LE(8) === entry.method, 'ZIP local/central header mismatch');
      const nameSize = local.readUInt16LE(26), extraSize = local.readUInt16LE(28);
      requireThat(zipName(read(entry.offset + 30, nameSize)) === entry.name, 'ZIP local/central name mismatch');
      zipExtra(read(entry.offset + 30 + nameSize, extraSize));
      entry.dataOffset = entry.offset + 30 + nameSize + extraSize;
      let next = entry.dataOffset + entry.compressed;
      const fields = [entry.crc, entry.compressed, entry.expanded];
      if (entry.flags & 8) {
        for (let index = 0; index < 3; index++) requireThat([0, fields[index]].includes(local.readUInt32LE(14 + index * 4)), 'ZIP local data descriptor mismatch');
        const hasSignature = read(next, 4).readUInt32LE(0) === 0x08074b50;
        const descriptor = read(next + (hasSignature ? 4 : 0), 12);
        requireThat(fields.every((value, index) => value === descriptor.readUInt32LE(index * 4)), 'ZIP data descriptor mismatch');
        next += hasSignature ? 16 : 12;
      } else requireThat(fields.every((value, index) => value === local.readUInt32LE(14 + index * 4)), 'ZIP local sizes/CRC mismatch');
      requireThat(next <= directoryOffset, 'ZIP entry overlaps central directory'); previousEnd = next;
    }
    requireThat(previousEnd === directoryOffset, 'Unparsed data before ZIP directory');
    const data = entry => {
      const compressed = read(entry.dataOffset, entry.compressed);
      const bytes = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.expanded), info: true });
      const output = entry.method === 0 ? bytes : bytes.buffer;
      requireThat(entry.method === 0 || bytes.engine.bytesWritten === compressed.length, 'Trailing compressed ZIP data');
      requireThat(output.length === entry.expanded && crc32(output) === entry.crc, `ZIP size/CRC failure: ${entry.name}`);
      return output;
    };
    return { entries, data, close: () => fs.closeSync(fd) };
  } catch (error) { fs.closeSync(fd); throw error; }
}

function inspectElf(bytes, abi, name = 'native library') {
  const specification = ABIS[abi];
  requireThat(specification && bytes.length >= 52 && bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])), `${name}: invalid ELF or ABI`);
  const elfClass = bytes[4], is64 = elfClass === 2, headerSize = is64 ? 64 : 52, programSize = is64 ? 56 : 32;
  requireThat(elfClass === specification[0] && bytes[5] === 1 && bytes[6] === 1 && bytes.length >= headerSize,
    `${name}: unsupported ELF class/endianness/version for ${abi}`);
  requireThat(bytes.readUInt16LE(16) === 3 && bytes.readUInt16LE(18) === specification[1] && bytes.readUInt32LE(20) === 1, `${name}: ELF must be a matching shared object`);
  const word = offset => is64 ? bytes.readBigUInt64LE(offset) : BigInt(bytes.readUInt32LE(offset));
  const programOffset = word(is64 ? 32 : 28), programCount = bytes.readUInt16LE(is64 ? 56 : 44);
  requireThat(bytes.readUInt16LE(is64 ? 52 : 40) === headerSize && bytes.readUInt16LE(is64 ? 54 : 42) === programSize &&
    programCount > 0 && programCount <= 1024 && programOffset >= BigInt(headerSize) && programOffset + BigInt(programCount * programSize) <= BigInt(bytes.length), `${name}: invalid ELF program headers`);
  let loads = 0, relro = 0;
  for (let index = 0; index < programCount; index++) {
    const at = Number(programOffset) + index * programSize, type = bytes.readUInt32LE(at);
    if (type !== 1 && type !== 0x6474e552) continue;
    const offset = word(at + (is64 ? 8 : 4)), vaddr = word(at + (is64 ? 16 : 8));
    const filesz = word(at + (is64 ? 32 : 16)), memsz = word(at + (is64 ? 40 : 20)), align = word(at + (is64 ? 48 : 28));
    requireThat((type !== 1 || filesz <= memsz) && offset + filesz <= BigInt(bytes.length) && vaddr + memsz < (1n << BigInt(is64 ? 64 : 32)), `${name}: ELF segment range is invalid`);
    if (type === 1) {
      requireThat(align > 0n && (align & (align - 1n)) === 0n && vaddr % align === offset % align, `${name}: invalid ELF LOAD congruence/alignment`);
      requireThat(!is64 || align >= 16384n, `${name}: ELF LOAD alignment is below 16 KB`); loads++;
    } else {
      requireThat(!is64 || (vaddr + memsz) % 16384n === 0n, `${name}: GNU_RELRO end is not 16 KB aligned`); relro++;
    }
  }
  requireThat(loads > 0, `${name}: ELF has no LOAD segments`);
  return { abi, elfClass: is64 ? 64 : 32, loadSegments: loads, relroSegments: relro,
    alignment: is64 ? '16KB_LOAD_and_RELRO_verified' : '32bit_structure_only_16KB_not_applicable' };
}

function inspectManifest(xml, expected, moduleName = 'base') {
  requireThat(typeof xml === 'string' && Buffer.byteLength(xml) <= LIMITS.xml && !/<!DOCTYPE|<!ENTITY/i.test(xml), 'Manifest XML is oversized or contains forbidden DTD/entities');
  // Already installed through the Expo toolchain; absence is a hard failure, never a regex fallback.
  const { DOMParser } = require('@xmldom/xmldom');
  const errors = [];
  const document = new DOMParser({ errorHandler: { warning: message => errors.push(message), error: message => errors.push(message), fatalError: message => errors.push(message) } }).parseFromString(xml, 'application/xml');
  requireThat(errors.length === 0, 'Malformed manifest XML');
  const root = document.documentElement;
  requireThat(root?.tagName === 'manifest' && !root.namespaceURI && root.getAttribute('package') === PACKAGE, `${moduleName}: manifest package must be ${PACKAGE}`);
  const roots = Array.from(document.childNodes).filter(node => node.nodeType === 1);
  requireThat(roots.length === 1 && Array.from(document.childNodes).every(node => node.nodeType !== 3 || !node.data.trim()), 'Manifest must contain exactly one XML root');
  const elements = [], stack = [[root, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    requireThat(elements.length < 20000 && depth <= 64, 'Manifest XML structure exceeds limits'); elements.push(node);
    for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) stack.push([child, depth + 1]);
  }
  const children = name => elements.filter(node => node.tagName === name && !node.namespaceURI && node.parentNode === root);
  const attr = (node, name) => node?.hasAttributeNS(ANDROID_NS, name) ? node.getAttributeNS(ANDROID_NS, name) : null;
  const versionCode = attr(root, 'versionCode'), versionName = attr(root, 'versionName');
  requireThat(moduleName !== 'base' || (versionCode !== null && versionName !== null), 'Base manifest versionCode/versionName are required');
  if (versionCode !== null) requireThat(positiveInteger(versionCode, 'manifest versionCode') === expected.versionCode, `${moduleName}: unexpected versionCode`);
  if (versionName !== null) requireThat(versionName === expected.versionName, `${moduleName}: unexpected versionName`);
  const major = attr(root, 'versionCodeMajor');
  requireThat(major === null || major === '0', 'versionCodeMajor is unsupported for this Play release');
  const sdk = children('uses-sdk');
  requireThat(sdk.length <= 1 && (moduleName !== 'base' || sdk.length === 1), `${moduleName}: expected one uses-sdk`);
  let targetSdk = null;
  if (sdk.length) {
    targetSdk = positiveInteger(attr(sdk[0], 'targetSdkVersion'), 'targetSdkVersion', 10000);
    requireThat(targetSdk >= 36, `${moduleName}: targetSdkVersion must be >= 36`);
  }
  const applications = children('application');
  requireThat(applications.length <= 1 && (moduleName !== 'base' || applications.length === 1), `${moduleName}: expected one application`);
  const application = applications[0];
  if (application) {
    const backup = attr(application, 'allowBackup'), debug = attr(application, 'debuggable');
    requireThat(backup === 'false' || (moduleName !== 'base' && backup === null), `${moduleName}: allowBackup must explicitly be false`);
    // Android's documented default for an omitted debuggable attribute is false.
    requireThat(debug === null || debug === 'false', `${moduleName}: debuggable must be false or absent`);
    requireThat([null, 'false'].includes(attr(application, 'testOnly')), `${moduleName}: testOnly is forbidden`);
    requireThat([null, 'false'].includes(attr(application, 'pageSizeCompat')), `${moduleName}: forced page-size compatibility mode is forbidden`);
  }
  const permissions = [];
  for (const element of elements) {
    if (element.localName?.startsWith('uses-permission')) {
      requireThat(!element.namespaceURI && ['uses-permission', 'uses-permission-sdk-23', 'uses-permission-sdk-m'].includes(element.tagName) && element.parentNode === root, 'Unsupported permission declaration');
      const name = attr(element, 'name');
      requireThat(name && /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name), 'Unresolved permission name');
      requireThat(!DISALLOWED.has(name), `${moduleName}: disallowed permission ${name}`); permissions.push(name);
    }
  }
  return { module: moduleName, package: PACKAGE, versionCode: versionCode === null ? null : Number(versionCode), versionName, targetSdk,
    allowBackup: application ? false : null, debuggable: application ? false : null, permissions: [...new Set(permissions)].sort() };
}

function inspectBundleConfig(text) {
  requireThat(Buffer.byteLength(text) <= LIMITS.xml, 'Bundle config dump exceeds limit');
  let config;
  try { config = JSON.parse(text); } catch { throw new Error('bundletool dump config did not return valid JSON'); }
  requireThat(config && typeof config === 'object' && !Array.isArray(config), 'Invalid bundle config');
  requireThat(!config.type || config.type === 'REGULAR', 'Only regular Android app bundles are supported');
  const native = config.optimizations?.uncompressNativeLibraries;
  requireThat(native?.enabled === true && native.alignment === 'PAGE_ALIGNMENT_16K',
    'Bundle must explicitly request enabled PAGE_ALIGNMENT_16K native-library packaging; APK zip alignment remains a separate gate');
  return { nativeLibraries: 'PAGE_ALIGNMENT_16K', producerBundletoolVersion: config.bundletool?.version || null };
}

function inspectPublicCertificate(bytes, expectedFingerprint, now = Date.now()) {
  requireThat(bytes.length > 0 && bytes.length <= 65536 && !bytes.toString('ascii').includes('PRIVATE KEY'), 'Supply only a bounded public upload certificate');
  const pem = bytes.toString('ascii');
  if (pem.includes('-----BEGIN')) requireThat(/^\s*-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----\s*$/.test(pem), 'Expected exactly one PEM public certificate');
  const certificate = new X509Certificate(bytes);
  requireThat(pem.includes('-----BEGIN') || certificate.raw.equals(bytes), 'Trailing data after DER public certificate');
  const fingerprint = certificate.fingerprint256.replaceAll(':', '').toLowerCase();
  requireThat(typeof expectedFingerprint === 'string' && /^(?:[0-9a-fA-F]{64}|(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2})$/.test(expectedFingerprint), '--upload-cert-sha256 must be the independently recorded public upload certificate fingerprint');
  requireThat(fingerprint === expectedFingerprint.replaceAll(':', '').toLowerCase(), 'Upload certificate fingerprint mismatch');
  requireThat(Number.isFinite(now) && Date.parse(certificate.validFrom) <= now && now <= Date.parse(certificate.validTo), 'Upload certificate is expired or not yet valid');
  requireThat(!/Android Debug/i.test(certificate.subject), 'Android debug signing certificate is forbidden');
  if (certificate.subject === certificate.issuer) requireThat(certificate.verify(certificate.publicKey), 'Invalid self-signed public certificate');
  return { certificate, fingerprint };
}

function runCommand(executable, args, { cwd, runner = spawnSync } = {}) {
  // Minimal environment avoids NODE_OPTIONS/JAVA_TOOL_OPTIONS, credential inheritance and user .keystore reads.
  const env = { PATH: path.dirname(executable), HOME: cwd, TMPDIR: cwd, LANG: 'C', LC_ALL: 'C' };
  const result = runner(executable, args, { cwd, env, shell: false, encoding: 'utf8', maxBuffer: LIMITS.output,
    timeout: 180000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] });
  requireThat(!result.error && !result.signal && Number.isInteger(result.status), `${path.basename(executable)} unavailable, timed out, interrupted or exceeded output limit`);
  requireThat(result.status === 0, `${path.basename(executable)} failed (exit ${result.status}); verification is incomplete`);
  requireThat(typeof result.stdout === 'string' && typeof result.stderr === 'string' && Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= LIMITS.output, 'Invalid/oversized tool output');
  return result;
}
function inspectSignerCertificate(text, certificate) {
  // jarsigner aliases can match ANY certificate in a chain, so explicitly pin the leaf as well.
  // keytool prints each CodeSigner's leaf first, followed by its chain (and optional timestamp).
  requireThat(/^\s*Signer #1:\s/m.test(text) && [...text.matchAll(/^Signer #\d+:\s*$/gm)].length === 1, 'Expected exactly one verified AAB signer');
  const firstPem = /-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----/.exec(text);
  requireThat(firstPem && new X509Certificate(firstPem[0]).raw.equals(certificate.raw), 'AAB signer leaf does not match the pinned public upload certificate');
}
function verifySignature(aab, certificate, tools, temporary, runner) {
  const publicFile = path.join(temporary, 'upload-public.der'), store = path.join(temporary, 'upload-trust.jks');
  fs.writeFileSync(publicFile, certificate.raw, { flag: 'wx', mode: 0o600 });
  // This password protects no secret: the temporary store contains one PUBLIC trusted certificate only.
  const storePassword = 'public-certificate-only';
  const javaOptions = ['-J-Duser.language=en', '-J-Duser.country=US', `-J-Duser.home=${temporary}`, '-J-Xmx1024m'];
  runCommand(tools.keytool, [...javaOptions, '-importcert', '-noprompt', '-alias', 'expected-upload', '-file', publicFile,
    '-keystore', store, '-storetype', 'JKS', '-storepass', storePassword], { cwd: temporary, runner });
  const result = runCommand(tools.jarsigner, [...javaOptions, '-verify', '-strict', '-verbose', '-certs',
    '-keystore', store, '-storetype', 'JKS', '-storepass', storePassword, aab, 'expected-upload'], { cwd: temporary, runner });
  requireThat(/^jar verified\.$/m.test(result.stdout) && !/jar is unsigned|treated as unsigned|with signer errors|unsigned entries/i.test(result.stdout + result.stderr),
    'jarsigner did not confirm a completely signed, trusted artifact');
  const signer = runCommand(tools.keytool, [...javaOptions, '-printcert', '-rfc', '-jarfile', aab], { cwd: temporary, runner });
  inspectSignerCertificate(signer.stdout, certificate);
  return { method: 'jarsigner -verify -strict with pinned public-certificate truststore, alias and exact signer-leaf check', outputSha256: sha256(result.stdout + result.stderr) };
}

function verifyRelease(options, { runner = spawnSync } = {}) {
  const expected = { versionCode: positiveInteger(options['expected-version-code'], '--expected-version-code'), versionName: options['expected-version-name'] };
  requireThat(typeof expected.versionName === 'string' && expected.versionName.trim() === expected.versionName && expected.versionName.length > 0 && expected.versionName.length <= 128 && !/[\x00-\x1f@?]/.test(expected.versionName), '--expected-version-name must be an explicit literal version');
  const abis = expectedAbis(options['expected-abis']);
  const aab = localFile(options.aab, '--aab');
  requireThat(/\.aab$/i.test(aab), '--aab must point to an Android App Bundle (.aab)');
  requireThat(Boolean(options.bundletool) !== Boolean(options['bundletool-executable']), 'Supply exactly one --bundletool JAR or --bundletool-executable');
  const bundletool = localFile(options.bundletool || options['bundletool-executable'], 'bundletool', LIMITS.archive, !options.bundletool);
  const tools = { keytool: localFile(options.keytool, '--keytool', LIMITS.archive, true), jarsigner: localFile(options.jarsigner, '--jarsigner', LIMITS.archive, true) };
  if (options.bundletool) tools.java = localFile(options.java, '--java', LIMITS.archive, true);
  const certificateFile = localFile(options['upload-cert'], '--upload-cert', 65536);
  const certificate = inspectPublicCertificate(fs.readFileSync(certificateFile), options['upload-cert-sha256']);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'expenzo-aab-verify-'));
  let archive;
  try {
    const snapshot = path.join(temporary, 'artifact.aab');
    copySnapshot(aab, snapshot);
    archive = openZip(snapshot);
    const byName = new Map(archive.entries.map(entry => [entry.name, entry]));
    for (const required of ['BundleConfig.pb', 'base/manifest/AndroidManifest.xml', 'META-INF/MANIFEST.MF']) requireThat(byName.has(required), `AAB missing ${required}`);
    const signatures = archive.entries.filter(entry => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/.test(entry.name));
    requireThat(signatures.length === 1 && byName.has(signatures[0].name.replace(/\.(RSA|DSA|EC)$/, '.SF')), 'Expected exactly one AAB JAR signing identity');
    const moduleNames = archive.entries.filter(entry => entry.name.endsWith('/manifest/AndroidManifest.xml')).map(entry => {
      requireThat(/^[A-Za-z][A-Za-z0-9_]*\/manifest\/AndroidManifest.xml$/.test(entry.name), `Unsupported module manifest path: ${entry.name}`);
      return entry.name.split('/')[0];
    }).sort();
    requireThat(moduleNames.includes('base') && moduleNames.length <= 32, 'Missing base or unsupported module count');
    const natives = [];
    for (const entry of archive.entries) {
      const bytes = archive.data(entry); // CRC/size verify every entry, bounded one entry at a time.
      if (!entry.name.endsWith('.so')) continue;
      const match = /^([A-Za-z][A-Za-z0-9_]*)\/lib\/([^/]+)\/([^/]+\.so)$/.exec(entry.name);
      requireThat(match && moduleNames.includes(match[1]) && Object.hasOwn(ABIS, match[2]), `Unclassified/unsupported native library: ${entry.name}`);
      natives.push({ path: entry.name, sha256: sha256(bytes), ...inspectElf(bytes, match[2], entry.name) });
    }
    const foundAbis = [...new Set(natives.map(native => native.abi))].sort();
    requireThat(JSON.stringify(foundAbis) === JSON.stringify(abis), `Native ABI set mismatch: expected ${abis.join(',')}; found ${foundAbis.join(',') || '(none)'}`);
    for (const native of natives) {
      const counterpart = { 'armeabi-v7a': 'arm64-v8a', x86: 'x86_64' }[native.abi];
      if (counterpart) requireThat(byName.has(native.path.replace(`/lib/${native.abi}/`, `/lib/${counterpart}/`)), `Missing 64-bit counterpart for ${native.path}`);
    }
    const signature = verifySignature(snapshot, certificate.certificate, tools, temporary, runner);
    const bundle = args => runCommand(options.bundletool ? tools.java : bundletool,
      options.bundletool ? ['-Duser.language=en', '-Duser.country=US', `-Duser.home=${temporary}`, '-Xmx1024m', '-jar', bundletool, ...args] : args,
      { cwd: temporary, runner });
    const bundletoolVersion = bundle(['version']).stdout.trim();
    requireThat(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(bundletoolVersion), 'Unknown bundletool version output');
    bundle(['validate', `--bundle=${snapshot}`]);
    const manifests = moduleNames.map(moduleName => inspectManifest(bundle(['dump', 'manifest', `--bundle=${snapshot}`, `--module=${moduleName}`]).stdout, expected, moduleName));
    const packaging = inspectBundleConfig(bundle(['dump', 'config', `--bundle=${snapshot}`]).stdout);
    const artifactHash = fileHash(snapshot);
    requireThat(fileHash(aab) === artifactHash, 'Supplied artifact changed during verification');
    return { schemaVersion: 1, scope: 'static-aab-verification-only', staticChecks: 'passed', releaseReady: false,
      artifact: { path: aab, bytes: fs.statSync(snapshot).size, sha256: artifactHash },
      uploadCertificateSha256: certificate.fingerprint, signature,
      tooling: { node: process.version, bundletool: { path: bundletool, version: bundletoolVersion, sha256: fileHash(bundletool) },
        ...Object.fromEntries(Object.entries(tools).map(([name, file]) => [name, { path: file, sha256: fileHash(file) }])) },
      manifests, abis: foundAbis, nativeLibraries: natives, packaging,
      unverified: [...DEVICE_GATES] };
  } finally {
    if (archive) archive.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

const HELP = `Static Android release artifact verifier (does not build or test a device).
Usage: node scripts/verify-android-release.cjs \\
  --aab /absolute/release.aab --bundletool /absolute/bundletool-all.jar \\
  --java /absolute/jdk/bin/java --jarsigner /absolute/jdk/bin/jarsigner \\
  --keytool /absolute/jdk/bin/keytool --upload-cert /absolute/upload-public.pem \\
  --upload-cert-sha256 ACTUAL_PUBLIC_CERT_SHA256 \\
  --expected-version-code ACTUAL_CODE --expected-version-name ACTUAL_NAME \\
  --expected-abis arm64-v8a,armeabi-v7a,x86,x86_64
Alternatively supply --bundletool-executable /absolute/local/bundletool instead of --bundletool/--java.
All expectations must come from the intended release, not from this example.
Exit 0 = static checks only; JSON always lists outstanding real-device/APK gates.
Missing evidence, tool errors, malformed/unsupported artifacts: exit 1; no pass report.
See docs/android-release-verification.md.`;
function parseArgs(argv) {
  const allowed = new Set(['aab', 'bundletool', 'bundletool-executable', 'java', 'jarsigner', 'keytool', 'upload-cert', 'upload-cert-sha256', 'expected-version-code', 'expected-version-name', 'expected-abis']);
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index].slice(2), value = argv[index + 1];
    requireThat(argv[index].startsWith('--') && allowed.has(key) && !Object.hasOwn(options, key) && typeof value === 'string' && value.length > 0 && !value.startsWith('--'), `Unknown, duplicate or valueless argument: ${argv[index]}`);
    options[key] = value;
  }
  return options;
}
if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--help') console.log(HELP);
  else {
    try { console.log(JSON.stringify(verifyRelease(parseArgs(process.argv.slice(2))), null, 2)); }
    catch (error) { console.error(`Android release verification FAILED/INCOMPLETE: ${error.message}`); process.exitCode = 1; }
  }
}
module.exports = { LIMITS, DISALLOWED, DEVICE_GATES, crc32, openZip, inspectElf, inspectManifest, inspectBundleConfig,
  inspectPublicCertificate, inspectSignerCertificate, runCommand, verifySignature, verifyRelease, parseArgs, expectedAbis };
