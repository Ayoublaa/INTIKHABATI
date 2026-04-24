// auth.js — verifies the request comes from the contract owner wallet
// Used for admin-only endpoints. The frontend sends the wallet address
// in the x-wallet header after MetaMask connection.

const OWNER = (process.env.OWNER_ADDRESS || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266').toLowerCase();

function requireOwner(req, res, next) {
  const wallet = (req.headers['x-wallet'] || '').toLowerCase();
  if (!wallet || wallet !== OWNER) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
}

module.exports = { requireOwner };
