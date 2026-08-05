import { EffectCallback, useEffect } from 'react';

export const useMountEffect = (effect: EffectCallback) => {
  // eslint-disable-next-line no-restricted-syntax, react-hooks/exhaustive-deps
  useEffect(effect, []);
};
