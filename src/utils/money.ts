/** Integer amount in poisha (৳1 = 100 poisha). The brand stops raw numbers or taka slipping in. */
export type Poisha = number & { __brand: 'poisha' };

export const toPoisha = (taka: number): Poisha => Math.round(taka * 100) as Poisha;
