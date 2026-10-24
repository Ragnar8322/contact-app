// Variante del navegador sin polyfills; mismos tipos que el paquete principal.
declare module "exceljs/dist/exceljs.bare.min.js" {
  const ExcelJS: typeof import("exceljs");
  export default ExcelJS;
}
