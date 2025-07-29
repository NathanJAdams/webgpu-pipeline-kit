import { Not } from './Not';

export type OneOrBoth<A, B> = (A & Partial<B>) | (B & Partial<A>);

export type OneOrBothExact<A, B> =
  | (A & Not<B>)
  | (B & Not<A>)
  | (A & B);
