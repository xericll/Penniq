import { useMemo } from 'react';
import { summarizeAssets } from '../lib/assets';
import { debtsOf, roundMoney } from '../lib/ledger';
import { usePlanner } from '../state/PlannerContext';
import { useWallet } from '../state/WalletContext';

/** Net worth from every ledger plus the assets: wallet + vault + assets + money lent − money borrowed. */
export function useNetWorth() {
  const { balances, transactions } = useWallet();
  const { assets } = usePlanner();
  return useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    for (const d of debtsOf(transactions)) {
      if (d.side === 'lent') lent += d.remaining;
      else borrowed += d.remaining;
    }
    const assetsTotal = summarizeAssets(assets).total;
    return {
      assets: assetsTotal,
      lent: roundMoney(lent),
      borrowed: roundMoney(borrowed),
      total: roundMoney(balances.total + balances.vault + assetsTotal + lent - borrowed),
    };
  }, [balances, transactions, assets]);
}
