const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateKeyPairSync, sign, X509Certificate } = require('node:crypto');
const { deflateRawSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const verifier = require('../scripts/verify-android-release.cjs');

// Every artifact here is synthetic unit-test input, never an Android release or device attestation.
const expected = { versionCode: 42, versionName: 'fixture-42' };
const manifest = ({ permissions = '', application = 'a:allowBackup="false"', sdk = '36' } = {}) =>
  `<?xml version="1.0"?><manifest xmlns:a="http://schemas.android.com/apk/res/android" package="com.nustudent.expenzo" a:versionCode="42" a:versionName="fixture-42"><uses-sdk a:targetSdkVersion="${sdk}"/>${permissions}<application ${application}/></manifest>`;
const config = JSON.stringify({ optimizations: { uncompressNativeLibraries: { enabled: true, alignment: 'PAGE_ALIGNMENT_16K' } } });
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expenzo-verifier-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function elf({ abi = 'arm64-v8a', align = 16384n, vaddr = 0n, offset = 0n, noLoads = false, relroEnd } = {}) {
  const specs = { 'arm64-v8a': [2, 183], x86_64: [2, 62], 'armeabi-v7a': [1, 40], x86: [1, 3] };
  const [kind, machine] = specs[abi], is64 = kind === 2, header = is64 ? 64 : 52, phsize = is64 ? 56 : 32;
  const bytes = Buffer.alloc(512), count = relroEnd === undefined ? 1 : 2;
  Buffer.from([127, 69, 76, 70, kind, 1, 1]).copy(bytes);
  bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(machine, 18); bytes.writeUInt32LE(1, 20);
  const word = (value, at) => is64 ? bytes.writeBigUInt64LE(BigInt(value), at) : bytes.writeUInt32LE(Number(value), at);
  word(header, is64 ? 32 : 28);
  bytes.writeUInt16LE(header, is64 ? 52 : 40); bytes.writeUInt16LE(phsize, is64 ? 54 : 42); bytes.writeUInt16LE(count, is64 ? 56 : 44);
  bytes.writeUInt32LE(noLoads ? 2 : 1, header);
  word(offset, header + (is64 ? 8 : 4)); word(vaddr, header + (is64 ? 16 : 8));
  word(256, header + (is64 ? 32 : 16)); word(256, header + (is64 ? 40 : 20)); word(align, header + (is64 ? 48 : 28));
  if (relroEnd !== undefined) {
    const at = header + phsize;
    bytes.writeUInt32LE(0x6474e552, at);
    word(BigInt(relroEnd) - 16n, at + (is64 ? 16 : 8)); word(16, at + (is64 ? 40 : 20)); word(1, at + (is64 ? 48 : 28));
  }
  return bytes;
}

function zip(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = entry.data || Buffer.alloc(0), method = entry.method || 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = verifier.crc32(data), flags = entry.flags || 0, descriptor = Boolean(flags & 8);
    const local = Buffer.alloc(30), directory = Buffer.alloc(46), extra = entry.extra || Buffer.alloc(0);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    if (!descriptor) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); }
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(extra.length, 28);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x0314, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(flags, 8); directory.writeUInt16LE(method, 10); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt16LE(extra.length, 30);
    directory.writeUInt32LE(entry.external || 0, 38); directory.writeUInt32LE(offset, 42);
    const trailer = Buffer.alloc(descriptor ? 16 : 0);
    if (descriptor) { trailer.writeUInt32LE(0x08074b50); trailer.writeUInt32LE(crc, 4); trailer.writeUInt32LE(compressed.length, 8); trailer.writeUInt32LE(data.length, 12); }
    locals.push(local, name, extra, compressed, trailer); central.push(directory, name, extra);
    offset += local.length + name.length + extra.length + compressed.length + trailer.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// Build an ephemeral self-signed X.509 PUBLIC fixture with Node crypto; no private key is read/written.
function der(tag, content) {
  const data = Buffer.isBuffer(content) ? content : Buffer.concat(content);
  const size = data.length < 128 ? Buffer.from([data.length]) : data.length < 256 ? Buffer.from([0x81, data.length]) : Buffer.from([0x82, data.length >>> 8, data.length & 255]);
  return Buffer.concat([Buffer.from([tag]), size, data]);
}
function publicCertificate(commonName = 'synthetic-unit-test-upload-never-release') {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = der(0x30, [der(6, Buffer.from('2a864886f70d01010b', 'hex')), der(5, Buffer.alloc(0))]);
  const subject = der(0x30, [der(0x31, [der(0x30, [der(6, Buffer.from('550403', 'hex')), der(12, Buffer.from(commonName))])])]);
  const body = der(0x30, [der(2, Buffer.from([1])), algorithm, subject,
    der(0x30, [der(23, Buffer.from('200101000000Z')), der(23, Buffer.from('400101000000Z'))]),
    subject, publicKey.export({ type: 'spki', format: 'der' })]);
  return new X509Certificate(der(0x30, [body, algorithm, der(3, Buffer.concat([Buffer.from([0]), sign('sha256', body, privateKey)]))]));
}
const certificate = publicCertificate();
const signerOutput = value => `Signer #1:\n\nCertificate #1:\nCertificate owner: CN=synthetic-unit-test\n\n${value.toString()}\n`;

test('manifest verifies XML namespaces, exact identity/version and documented debuggable default', () => {
  const result = verifier.inspectManifest(manifest(), expected);
  assert.equal(result.targetSdk, 36); assert.equal(result.allowBackup, false); assert.equal(result.debuggable, false);
  assert.equal(verifier.inspectManifest(manifest({ sdk: '37', application: 'a:allowBackup="false" a:debuggable="false"' }), expected).targetSdk, 37);
});

test('manifest fails closed on wrong package, version, SDK, backup and debugging', () => {
  for (const xml of [manifest().replace('com.nustudent.expenzo', 'com.example.other'), manifest().replace('"42"', '"41"'),
    manifest().replace('fixture-42', '@string/version'), manifest({ sdk: '35' }), manifest({ sdk: 'VanillaIceCream' }),
    manifest({ application: '' }), manifest({ application: 'a:allowBackup="true"' }),
    manifest({ application: 'a:allowBackup="false" a:debuggable="true"' }),
    manifest({ application: 'a:allowBackup="false" a:debuggable="@bool/debug"' }),
    manifest({ application: 'a:allowBackup="false" a:testOnly="true"' }),
    manifest({ application: 'a:allowBackup="false" a:pageSizeCompat="true"' }),
    manifest().replace('<application', '<uses-sdk a:targetSdkVersion="35"/><application')]) {
    assert.throws(() => verifier.inspectManifest(xml, expected));
  }
});

test('all blocked permissions are rejected even with sdk-specific declarations and maxSdk', () => {
  for (const permission of verifier.DISALLOWED) {
    for (const tag of ['uses-permission', 'uses-permission-sdk-23', 'uses-permission-sdk-m']) {
      assert.throws(() => verifier.inspectManifest(manifest({ permissions: `<${tag} a:name="${permission}" a:maxSdkVersion="32"/>` }), expected), /disallowed permission/);
    }
  }
  assert.deepEqual(verifier.inspectManifest(manifest({ permissions: '<uses-permission a:name="android.permission.INTERNET"/>' }), expected).permissions, ['android.permission.INTERNET']);
  assert.throws(() => verifier.inspectManifest(manifest({ permissions: '<uses-permission a:name="@string/permission"/>' }), expected), /permission/);
});

test('XML attacks, parser-recovery cases and structural ambiguity are rejected', () => {
  for (const xml of ['<!DOCTYPE manifest [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + manifest(),
    manifest().replace('</manifest>', ''), manifest() + '<second/>', manifest().replace('a:allowBackup="false"', 'a:allowBackup="false" a:allowBackup="true"'),
    manifest().replace('<application', '<uses-permission a:name="android.permission.CAMERA"/><application'),
    manifest().replace('<application', '<uses-permission-future a:name="android.permission.INTERNET"/><application'),
    manifest().replace('<application', '<x>'.repeat(66) + '</x>'.repeat(66) + '<application'),
    ' '.repeat(verifier.LIMITS.xml + 1)]) assert.throws(() => verifier.inspectManifest(xml, expected));
});

test('feature-module manifests cannot smuggle permissions or override release identity', () => {
  const feature = '<manifest xmlns:a="http://schemas.android.com/apk/res/android" package="com.nustudent.expenzo"><application/></manifest>';
  assert.doesNotThrow(() => verifier.inspectManifest(feature, expected, 'feature'));
  assert.throws(() => verifier.inspectManifest(feature.replace('<application/>', '<uses-permission a:name="android.permission.CAMERA"/>'), expected, 'feature'), /disallowed/);
  assert.throws(() => verifier.inspectManifest(feature.replace('<application/>', '<application a:debuggable="true"/>'), expected, 'feature'), /debuggable/);
});

test('ELF inspector checks both 64-bit ABIs and every LOAD segment with BigInt arithmetic', () => {
  for (const abi of ['arm64-v8a', 'x86_64']) {
    assert.equal(verifier.inspectElf(elf({ abi }), abi).alignment, '16KB_LOAD_and_RELRO_verified');
    assert.doesNotThrow(() => verifier.inspectElf(elf({ abi, align: 65536n, vaddr: 1n << 55n }), abi));
    assert.throws(() => verifier.inspectElf(elf({ abi, align: 4096n }), abi), /below 16 KB/);
    assert.throws(() => verifier.inspectElf(elf({ abi, align: 16385n }), abi), /congruence/);
    assert.throws(() => verifier.inspectElf(elf({ abi, vaddr: 4096n }), abi), /congruence/);
    const multiple = elf({ abi, relroEnd: 16384n });
    multiple.writeUInt32LE(1, 120); multiple.writeBigUInt64LE(0n, 136); multiple.writeBigUInt64LE(4096n, 168);
    assert.throws(() => verifier.inspectElf(multiple, abi), /below 16 KB/);
  }
});

test('ELF malformed headers, wrong ABI, no loads, bad ranges and RELRO alignment fail', () => {
  assert.throws(() => verifier.inspectElf(Buffer.alloc(20), 'arm64-v8a'), /invalid ELF/);
  assert.throws(() => verifier.inspectElf(elf(), 'x86_64'), /matching shared object/);
  assert.throws(() => verifier.inspectElf(elf({ noLoads: true }), 'arm64-v8a'), /no LOAD/);
  assert.throws(() => verifier.inspectElf(elf({ offset: 16384n }), 'arm64-v8a'), /range/);
  assert.throws(() => verifier.inspectElf(elf({ relroEnd: 4096n }), 'arm64-v8a'), /RELRO/);
  assert.doesNotThrow(() => verifier.inspectElf(elf({ relroEnd: 16384n }), 'arm64-v8a'));
  const shortenedRelro = elf({ relroEnd: 16384n });
  shortenedRelro.writeBigUInt64LE(32n, 152); // GNU_RELRO can have p_filesz > p_memsz; PT_LOAD cannot.
  assert.doesNotThrow(() => verifier.inspectElf(shortenedRelro, 'arm64-v8a'));
  for (const change of [bytes => { bytes[5] = 2; }, bytes => { bytes.writeBigUInt64LE(0xffffffffffffffffn, 32); }, bytes => { bytes.writeUInt16LE(0xffff, 56); }]) {
    const bytes = elf(); change(bytes); assert.throws(() => verifier.inspectElf(bytes, 'arm64-v8a'));
  }
  for (const abi of ['armeabi-v7a', 'x86']) assert.equal(verifier.inspectElf(elf({ abi, align: 4096n }), abi).alignment, '32bit_structure_only_16KB_not_applicable');
});

test('bundle packaging requires structured explicit 16 KB request, never a substring or skip', () => {
  assert.equal(verifier.inspectBundleConfig(config).nativeLibraries, 'PAGE_ALIGNMENT_16K');
  for (const text of ['{}', 'not json', '{"comment":"PAGE_ALIGNMENT_16K"}', config.replace('16K', '4K'), config.replace('true', 'false')]) {
    assert.throws(() => verifier.inspectBundleConfig(text));
  }
});

test('bounded ZIP reader handles stored/deflated data and data descriptors without extraction', t => {
  const directory = temporary(t), file = path.join(directory, 'fixture.aab');
  const entries = [{ name: 'base/file', data: Buffer.from('unit fixture'), method: 0 }, { name: 'base/deflated', data: Buffer.from('another fixture'), method: 8, flags: 8 }];
  fs.writeFileSync(file, zip(entries)); const archive = verifier.openZip(file);
  try { for (let index = 0; index < entries.length; index++) assert.deepEqual(archive.data(archive.entries[index]), entries[index].data); }
  finally { archive.close(); }
  assert.deepEqual(fs.readdirSync(directory), ['fixture.aab']);
});

test('ZIP traversal, duplicate names, symlinks, encrypted and unsupported entries are rejected', t => {
  const file = path.join(temporary(t), 'invalid.aab');
  for (const entries of [[{ name: '../escape' }], [{ name: '/absolute' }], [{ name: 'base/./file' }], [{ name: 'base//file' }], [{ name: 'base\\file' }],
    [{ name: 'base/file' }, { name: 'BASE/FILE' }], [{ name: 'base/link', external: 0xa0000000 }],
    [{ name: 'base/file', flags: 1 }], [{ name: 'base/file', method: 99 }],
    [{ name: 'base/file', extra: Buffer.from([1, 0, 0, 0]) }]]) {
    fs.writeFileSync(file, zip(entries)); assert.throws(() => verifier.openZip(file));
  }
});

test('ZIP rejects corruption, oversized claims, local/header mismatch and trailing data', t => {
  const file = path.join(temporary(t), 'invalid.aab'), good = zip([{ name: 'base/file', data: Buffer.from('fixture') }]);
  for (const change of [bytes => bytes.subarray(0, bytes.length - 1), bytes => Buffer.concat([bytes, Buffer.from([0])]),
    bytes => { bytes[30] = 88; return bytes; },
    bytes => { bytes.writeUInt32LE(verifier.LIMITS.entry + 1, bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 24); return bytes; }]) {
    fs.writeFileSync(file, change(Buffer.from(good))); assert.throws(() => verifier.openZip(file));
  }
  const corrupted = Buffer.from(good); corrupted[39] ^= 1; fs.writeFileSync(file, corrupted);
  const archive = verifier.openZip(file);
  try { assert.throws(() => archive.data(archive.entries[0]), /CRC/); } finally { archive.close(); }
});

test('public upload certificate requires pinned fingerprint and current validity, accepts self-signed', () => {
  assert.equal(verifier.inspectPublicCertificate(certificate.raw, certificate.fingerprint256).fingerprint, certificate.fingerprint256.replaceAll(':', '').toLowerCase());
  assert.throws(() => verifier.inspectPublicCertificate(certificate.raw, '0'.repeat(64)), /fingerprint mismatch/);
  assert.throws(() => verifier.inspectPublicCertificate(certificate.raw, certificate.fingerprint256, Date.UTC(2019, 0)), /not yet valid/);
  assert.throws(() => verifier.inspectPublicCertificate(certificate.raw, certificate.fingerprint256, Date.UTC(2041, 0)), /expired/);
  assert.throws(() => verifier.inspectPublicCertificate(Buffer.from(certificate.toString() + certificate.toString()), certificate.fingerprint256), /exactly one/);
  assert.throws(() => verifier.inspectPublicCertificate(Buffer.concat([certificate.raw, Buffer.from([0])]), certificate.fingerprint256), /Trailing data/);
  const debug = publicCertificate('Android Debug');
  assert.throws(() => verifier.inspectPublicCertificate(debug.raw, debug.fingerprint256), /debug signing/);
});

test('commands preserve literal paths/arguments and reject missing tools, signals, output limits and nonzero exits', () => {
  const executable = '/local/tool with spaces', args = ['--bundle=/fixture/$(touch NEVER).aab'];
  let called = false;
  verifier.runCommand(executable, args, { cwd: '/local/tmp', runner: (file, actual, options) => {
    called = true; assert.equal(file, executable); assert.deepEqual(actual, args); assert.equal(options.shell, false);
    assert.equal(options.env.JAVA_TOOL_OPTIONS, undefined); assert.equal(options.env.HOME, '/local/tmp');
    assert.equal(options.timeout, 180000); return { status: 0, stdout: '', stderr: '' };
  } });
  assert.ok(called);
  for (const result of [{ error: new Error('ENOENT'), status: null }, { signal: 'SIGKILL', status: null },
    { status: 1 }, { status: 4 }, { status: 16 }, { status: 32 }, { status: 0, stdout: 'x'.repeat(verifier.LIMITS.output + 1), stderr: '' }]) {
    assert.throws(() => verifier.runCommand(executable, args, { runner: () => result }));
  }
});

test('strict signature trust is pinned to public certificate and never ignores exit 4', t => {
  const directory = temporary(t), calls = [];
  const runner = (file, args) => { calls.push({ file, args }); return { status: 0, stdout: file === '/jdk/jarsigner' ? 'jar verified.\n' : args.includes('-printcert') ? signerOutput(certificate) : '', stderr: '' }; };
  verifier.verifySignature('/synthetic.aab', certificate, { keytool: '/jdk/keytool', jarsigner: '/jdk/jarsigner' }, directory, runner);
  assert.ok(calls[0].args.includes('-importcert')); assert.ok(calls[1].args.includes('-strict'));
  assert.equal(calls[1].args.at(-1), 'expected-upload'); assert.ok(calls[1].args.includes('-keystore'));
  for (const status of [4, 16, 32]) {
    const scratch = fs.mkdtempSync(path.join(directory, 'strict-'));
    assert.throws(() => verifier.verifySignature('/synthetic.aab', certificate, { keytool: '/jdk/keytool', jarsigner: '/jdk/jarsigner' }, scratch,
      file => ({ status: file === '/jdk/jarsigner' ? status : 0, stdout: 'jar verified, with signer errors.\n', stderr: '' })), /failed/);
  }
  const unsigned = fs.mkdtempSync(path.join(directory, 'unsigned-'));
  assert.throws(() => verifier.verifySignature('/synthetic.aab', certificate, { keytool: '/jdk/keytool', jarsigner: '/jdk/jarsigner' }, unsigned,
    () => ({ status: 0, stdout: 'jar is unsigned.', stderr: '' })), /completely signed/);
});

test('certificate chain trust cannot substitute another leaf for the approved upload identity', () => {
  assert.doesNotThrow(() => verifier.inspectSignerCertificate(signerOutput(certificate), certificate));
  const other = publicCertificate('synthetic-other-leaf');
  assert.throws(() => verifier.inspectSignerCertificate(signerOutput(other) + certificate.toString(), certificate), /signer leaf/);
  assert.throws(() => verifier.inspectSignerCertificate(signerOutput(certificate) + '\nSigner #2:\n' + other.toString(), certificate), /exactly one/);
  assert.throws(() => verifier.inspectSignerCertificate(certificate.toString(), certificate), /exactly one/);
});

function releaseFixture(t, extraEntries = []) {
  const directory = temporary(t), artifact = path.join(directory, 'synthetic $(never executed).aab');
  const entries = [
    { name: 'BundleConfig.pb', data: Buffer.from('SYNTHETIC, NOT A RELEASE') },
    { name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('SYNTHETIC PROTO PLACEHOLDER') },
    { name: 'META-INF/MANIFEST.MF', data: Buffer.from('SYNTHETIC, NOT SIGNED') },
    { name: 'META-INF/FIXTURE.RSA', data: Buffer.from('SYNTHETIC, NOT A SIGNATURE') },
    { name: 'META-INF/FIXTURE.SF', data: Buffer.from('SYNTHETIC, NOT A SIGNATURE') },
    { name: 'base/lib/arm64-v8a/libfixture.so', data: elf(), method: 8 }, ...extraEntries,
  ];
  fs.writeFileSync(artifact, zip(entries));
  const publicFile = path.join(directory, 'synthetic-public.der'); fs.writeFileSync(publicFile, certificate.raw);
  for (const name of ['bundletool.jar', 'java', 'jarsigner', 'keytool']) fs.writeFileSync(path.join(directory, name), 'synthetic inert tool fixture', { mode: 0o700 });
  const options = { aab: artifact, bundletool: path.join(directory, 'bundletool.jar'), java: path.join(directory, 'java'),
    jarsigner: path.join(directory, 'jarsigner'), keytool: path.join(directory, 'keytool'),
    'upload-cert': publicFile, 'upload-cert-sha256': certificate.fingerprint256,
    'expected-version-code': '42', 'expected-version-name': 'fixture-42', 'expected-abis': 'arm64-v8a' };
  const calls = [];
  const runner = (executable, args, settings) => {
    calls.push({ executable, args, settings });
    let stdout = '';
    if (executable === options.jarsigner) stdout = 'jar verified.\n';
    else if (args.includes('-printcert')) stdout = signerOutput(certificate);
    else if (args.at(-1) === 'version') stdout = '1.18.2\n';
    else if (args.includes('manifest')) stdout = manifest();
    else if (args.includes('config')) stdout = config;
    return { status: 0, stdout, stderr: '' };
  };
  return { directory, entries, options, calls, runner };
}

test('injected orchestration verifies all static gates and explicitly keeps release/device gates unverified', t => {
  const fixture = releaseFixture(t), report = verifier.verifyRelease(fixture.options, { runner: fixture.runner });
  assert.equal(report.staticChecks, 'passed'); assert.equal(report.releaseReady, false);
  assert.equal(report.scope, 'static-aab-verification-only'); assert.deepEqual(report.unverified, [...verifier.DEVICE_GATES]);
  assert.equal(report.nativeLibraries.length, 1); assert.equal(report.artifact.sha256.length, 64);
  assert.ok(fixture.calls.some(call => call.args.includes('validate')));
  assert.ok(fixture.calls.some(call => call.args.includes('--module=base')));
  assert.ok(fixture.calls.every(call => call.settings.shell === false));
  assert.ok(!fs.existsSync(fixture.calls[0].settings.cwd), 'temporary artifact and public trust store are removed');
});

test('orchestration fails on absent evidence, incorrect expectations and failed bundletool', t => {
  const fixture = releaseFixture(t);
  for (const key of ['aab', 'bundletool', 'java', 'jarsigner', 'keytool', 'upload-cert', 'upload-cert-sha256', 'expected-version-code', 'expected-version-name', 'expected-abis']) {
    const options = { ...fixture.options }; delete options[key];
    assert.throws(() => verifier.verifyRelease(options, { runner: fixture.runner }), `missing ${key}`);
  }
  assert.throws(() => verifier.verifyRelease({ ...fixture.options, 'expected-abis': 'arm64-v8a,x86_64' }, { runner: fixture.runner }), /ABI set mismatch/);
  assert.throws(() => verifier.verifyRelease({ ...fixture.options, 'expected-version-code': '43' }, { runner: fixture.runner }), /versionCode/);
  assert.throws(() => verifier.verifyRelease(fixture.options, { runner: (file, args, settings) => args.includes('validate')
    ? { status: 1, stdout: '', stderr: 'synthetic bundletool failure' } : fixture.runner(file, args, settings) }), /failed/);
});

test('every feature manifest is checked and unknown/hidden native paths cannot be skipped', t => {
  const fixture = releaseFixture(t, [{ name: 'feature/manifest/AndroidManifest.xml', data: Buffer.from('synthetic') }]);
  assert.throws(() => verifier.verifyRelease(fixture.options, { runner: (file, args, settings) => args.includes('--module=feature')
    ? { status: 0, stdout: manifest({ permissions: '<uses-permission a:name="android.permission.CAMERA"/>' }), stderr: '' }
    : fixture.runner(file, args, settings) }), /feature: disallowed/);
  fs.writeFileSync(fixture.options.aab, zip([...fixture.entries, { name: 'base/assets/hidden.so', data: elf() }]));
  assert.throws(() => verifier.verifyRelease(fixture.options, { runner: fixture.runner }), /Unclassified/);
  fs.writeFileSync(fixture.options.aab, zip([...fixture.entries, { name: 'unknown-module/manifest/AndroidManifest.xml', data: Buffer.from('synthetic') }]));
  assert.throws(() => verifier.verifyRelease(fixture.options, { runner: fixture.runner }), /Unsupported module manifest/);
});

test('32-bit libraries require a corresponding 64-bit library', t => {
  const fixture = releaseFixture(t, [{ name: 'base/lib/armeabi-v7a/libmissing.so', data: elf({ abi: 'armeabi-v7a' }) }]);
  assert.throws(() => verifier.verifyRelease({ ...fixture.options, 'expected-abis': 'armeabi-v7a,arm64-v8a' }, { runner: fixture.runner }), /Missing 64-bit counterpart/);
});

test('CLI rejects unknown/duplicate flags and missing artifact evidence with a nonzero exit', () => {
  assert.throws(() => verifier.parseArgs(['--skip-signature', 'true']), /Unknown/);
  assert.throws(() => verifier.parseArgs(['--aab', 'one', '--aab', 'two']), /duplicate/);
  assert.throws(() => verifier.expectedAbis('x86_64'), /including arm64/);
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/verify-android-release.cjs')], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /FAILED\/INCOMPLETE/); assert.equal(result.stdout, '');
});
