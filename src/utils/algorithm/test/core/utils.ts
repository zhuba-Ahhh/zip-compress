import { PhaseTiming } from '../../../../types';

/**
 * 记录阶段耗时并返回结果
 * 
 * @param name 阶段名称
 * @param fn 要执行的函数
 * @param phases 阶段耗时数组，如果存在则会将结果 push 进去
 */
export function trackPhase<T>(
  name: string,
  fn: () => T,
  phases?: PhaseTiming[]
): T {
  const start = performance.now();
  const result = fn();
  if (phases) {
    phases.push({ name, duration: performance.now() - start });
  }
  return result;
}
