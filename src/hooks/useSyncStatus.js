import { useEffect, useState } from 'react';
import { subscribeSync, syncState } from '../lib/sync';

export default function useSyncStatus() {
  const [state, setState] = useState(syncState);
  useEffect(() => subscribeSync(() => setState(syncState())), []);
  return state;
}
