import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function classNames(...classes: string[]) {
  const uniqueClasses = Array.from(new Set(classes.join(" ").split(" ")));
  return uniqueClasses.join(" ");
}
