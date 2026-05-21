export const heightLvh = (value: number) => {
  return `
    height: ${value}vh;
    height: ${value}lvh;
    height: calc(var(--vh, 1lvh) * ${value});
    `;
};
export const minHeightLvh = (value: number) => {
  return `
    min-height: ${value}vh;
    min-height: ${value}lvh;
    min-height: calc(var(--vh, 1lvh) * ${value});
    `;
};
export const marginTopLvh = (value: number) => {
  return `
      margin-top: ${value}vh;
      margin-top: ${value}lvh;
      margin-top: calc(var(--vh, 1lvh) * ${value});
    `;
};
export const marginBottomLvh = (value: number) => {
  return `
      margin-bottom: ${value}vh;
      margin-bottom: ${value}lvh;
      margin-bottom: calc(var(--vh, 1lvh) * ${value});
    `;
};
