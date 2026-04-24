const Joi = require('joi');

const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const hexPattern    = /^0x[a-fA-F0-9]+$/;

const schemas = {
  register: Joi.object({
    electionId:    Joi.number().integer().min(1).required(),
    cin:           Joi.string().alphanum().min(4).max(20).required(),
    walletAddress: Joi.string().pattern(walletPattern).required(),
    // v3: signature fields (required for wallet identity proof)
    signature:     Joi.string().pattern(hexPattern).min(130).max(134).required()
      .messages({ 'any.required': 'Wallet signature required — please reconnect MetaMask.' }),
    nonce:         Joi.string().hex().min(16).max(64).required()
      .messages({ 'any.required': 'Nonce required.' }),
  }),

  createElection: Joi.object({
    name:         Joi.string().min(3).max(100).required(),
    category:     Joi.number().integer().min(0).max(4).required(),
    deadline:     Joi.number().integer().min(0).required(),
    enableBlank:  Joi.boolean().default(true),
    commitReveal: Joi.boolean().default(false), // v3: commit-reveal mode
  }),

  addCandidate: Joi.object({
    name:  Joi.string().min(2).max(80).required(),
    party: Joi.string().max(80).default(''),
  }),

  openElection: Joi.object({
    electionId: Joi.number().integer().min(1).required(),
  }),
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();
    const { error, value } = schema.validate(req.body, { abortEarly: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message.replace(/"/g, ''),
      });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
