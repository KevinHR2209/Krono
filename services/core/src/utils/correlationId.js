const { v4: uuidv4 } = require('uuid');

function generateCorrelationId() {
  return uuidv4();
}

module.exports = {
  generateCorrelationId
};