// @ts-check

/** @type {import("@trivago/prettier-plugin-sort-imports").PrettierConfig} */
const config = {
  trailingComma: 'all',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  importOrder: [
    '^(.*)/register$',
    '<THIRD_PARTY_MODULES>',
    '<THIRD_PARTY_TS_TYPES>',
    '^[./]',
    '<TS_TYPES>^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: false,
  importOrderGroupNamespaceSpecifiers: false,
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
};

module.exports = config;
