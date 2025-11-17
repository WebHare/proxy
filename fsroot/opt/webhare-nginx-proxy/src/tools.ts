"use strict";

import { currentConfig } from "./config.ts";
import fs from "fs";
import os from 'os';

export function ensureDir(path: string) {
  try {
    // Throws if the dir does not exist
    fs.lstatSync(path);
  } catch (e) {
    fs.mkdirSync(path);
  }
}

export function ensureStorageDir(append?: string) {
  ensureDir(currentConfig.data_storage_path);
  const path = currentConfig.data_storage_path + "/" + (append || "");
  ensureDir(path);
  return path;
}

export function getLocalIPs() {
  const result: string[] = [];
  const ifaces = os.networkInterfaces();

  Object.keys(ifaces).forEach(ifname => {
    ifaces[ifname]?.forEach(iface => result.push(iface.address));
  });

  return result;
}

// the `| keyof X` is needed to be able to use a `keyof X` type as key parameter in DistributedPick or DistributedOmit in generics
export type DistributedKeys<X extends object> = (X extends object ? keyof X : never) | keyof X;

/** Applies Omit to all types in a union. Allows all keys that are not present in any object in the union. Warning: You might not be
    able to use all keys of the union if TypeScript has narrowed the union to a specific type. Eg:
```typescript
type A = { x: number; t: "a"; a: number } | { x: number; t: "b"; b: number };
const a: A = { t: "a", a: 1 };
const b = omit(a, ["b"]); // No overload matches this call. <snip> Type '"b"' is not assignable to type '"a" | "t" | "d"'.
```
    @typeParam T - Type of the supplied object
    @typeParam K - Type of the property keys to leave out
    @returns Type with only the specified keys left out (distributed over the union if present)
*/
export type DistributedOmit<X extends object, Y extends DistributedKeys<X>> = X extends object ? Omit<X, keyof X & Y> : never;

/** Returns an object with a selection of properties left out
    @typeParam T - Type of the supplied object
    @typeParam K - Type of the property keys to leave out
    @param obj - Object to leave properties out of
    @param keys - Names of the properties to remove
    @returns Resulting object
*/
export function omit<T extends object, K extends string & NoInfer<DistributedKeys<T>>>(obj: T, keys: readonly K[]): DistributedOmit<T, K>;

/** Returns an array with a selection of properties left out
    @typeParam T - Type of the supplied array
    @typeParam K - Type of the property keys to leave out
    @param arr - Array to leave properties out of
    @param keys - Names of the properties to leave out
    @returns Resulting array
*/
export function omit<T extends object, K extends string & NoInfer<DistributedKeys<T>>>(arr: T[], keys: readonly K[]): Array<DistributedOmit<T, K>>;

export function omit<T extends object, K extends string & NoInfer<DistributedKeys<T>>>(value: T | T[], keys: readonly K[]): DistributedOmit<T, K> | Array<DistributedOmit<T, K>> {
  if (Array.isArray(value))
    return value.map((elt: T) => omit(elt, keys));
  const ret = {} as T;
  for (const [key, val] of Object.entries(value)) {
    if (!keys.includes(key as K))
      ret[key as K] = val;
  }
  return ret as object as DistributedOmit<T, K>;
}
