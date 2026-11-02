// Profile photos are display-only in the Spark/free-tier release. There is no
// picker or Firebase Storage upload path in this build.
export const remoteProfileImage = (uri) => typeof uri === 'string' && uri.startsWith('https://') ? uri : null;
