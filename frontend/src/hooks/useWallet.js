import { useState, useEffect } from 'react';

const OWNER = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

export function useWallet() {
  const [wallet,   setWallet]   = useState('');
  const [isOwner,  setIsOwner]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  async function check(accounts) {
    const addr = accounts?.[0] || '';
    setWallet(addr);
    setIsOwner(addr.toLowerCase() === OWNER.toLowerCase());
  }

  async function connect() {
    if (!window.ethereum) return alert('Please install MetaMask');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await check(accounts);
  }

  useEffect(() => {
    (async () => {
      if (!window.ethereum) { setLoading(false); return; }
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      await check(accounts);
      setLoading(false);
      window.ethereum.on('accountsChanged', check);
    })();
    return () => window.ethereum?.removeListener?.('accountsChanged', check);
  }, []);

  return { wallet, isOwner, loading, connect };
}
