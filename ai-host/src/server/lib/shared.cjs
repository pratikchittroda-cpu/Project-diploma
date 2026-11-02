'use strict';

// Keep financial periods, duplicate-budget selection, paise rounding and the
// provider contract identical to the existing server implementation.
module.exports = {
  ...require('../../../../functions/lib/validation'),
  ...require('../../../../functions/lib/finance'),
  ...require('../../../../functions/lib/provider'),
};
