/**
 * Returns the conversion queue name for the given plan.
 * Queue definitions are in lib/trigger/queues.ts.
 */
export const conversionQueueName = (plan: string): string => {
  const planName = plan.split("+")[0];
  return `conversion-${planName}`;
};
