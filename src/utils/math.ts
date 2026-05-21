/**
 * @fileoverview Utility function to transform a value from one range to another
 * Takes a value and maps it from its original min/max range to a new min/max range
 * Clamps the input value to the original range before transforming
 */
export const transformRange = (
  value: number,
  min: number,
  max: number,
  newMin: number,
  newMax: number,
) => {
  const normalized = (Math.min(Math.max(value, min), max) - min) / (max - min);
  return newMin + normalized * (newMax - newMin);
};

/**
 * @fileoverview Linear interpolation (lerp) function for smooth transitions
 * Calculates intermediate value between start and end based on interpolation factor
 * Commonly used for animations and gradual value changes
 * @param start Starting value
 * @param end Ending value
 * @param t Interpolation factor (0-1)
 * @returns Interpolated value
 */
export const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};

/**
 * @fileoverview Debounce utility to limit how often a function can be called
 * Creates a debounced version of the provided function that delays execution
 * Useful for handling frequent events like resize or scroll
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number,
): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  }) as T;
};

/**
 * @fileoverview Interpolation utility for transitioning between object states
 * Takes a start object and end object with numeric or unit-based values (e.g. '10px', 'rotate(45deg)')
 * Interpolates between corresponding properties based on a progress value (0-1)
 * Handles CSS units and transform functions while maintaining correct formatting
 * Returns an object with interpolated values in their original format
 */
export const interpolate = (
  start: { [key: string]: any },
  end: { [key: string]: any },
  progress: number,
) => {
  const result: { [key: string]: any } = {};

  // Helper to extract number from string with units
  const extractNumber = (
    value: any,
  ): { number: number; unit: string | null } => {
    if (typeof value === "number") return { number: value, unit: null };
    if (typeof value === "string") {
      // Handle CSS transform functions like translate(10px) or rotate(45deg)
      const functionMatch = value.match(/^([a-zA-Z]+)\(([-0-9.]+)([^)]*)\)$/);
      if (functionMatch) {
        return {
          number: parseFloat(functionMatch[2]),
          unit: `${functionMatch[1]}(${functionMatch[3]})`,
        };
      }
      // Handle regular values with units like 45deg or 100px
      const match = value.match(/([-0-9.]+)([^0-9.]+)/);
      if (match) {
        return {
          number: parseFloat(match[1]),
          unit: match[2],
        };
      }
    }
    return { number: 0, unit: null };
  };

  // Interpolate each property in the objects
  for (const key in start) {
    const startVal = extractNumber(start[key]);
    const endVal = extractNumber(end[key]);

    if (startVal.unit !== null || endVal.unit !== null) {
      const unit = startVal.unit || endVal.unit;
      if (unit?.includes("(")) {
        // Check if it's any CSS transform function
        result[key] =
          `${unit.split("(")[0]}(${lerp(startVal.number, endVal.number, progress)}${unit.split(")")[0].slice(unit.split("(")[0].length)})`;
      } else {
        result[key] =
          `${lerp(startVal.number, endVal.number, progress)}${unit}`;
      }
    } else {
      result[key] = lerp(startVal.number, endVal.number, progress);
    }
  }

  return result;
};
