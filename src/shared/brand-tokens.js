/**
 * Allegiant brand tokens — single source of truth.
 *
 * Every layer that produces visual output (Generation, Review/Signoff, Export)
 * imports from here. Do not hardcode brand colors or fonts in layer code.
 *
 * These tokens describe Allegiant's brand (used in the Web WIZARDD UI itself
 * and in any Allegiant-attributed footer/credit on partner sites). They do
 * NOT describe a partner's brand — partner brand tokens come from
 * intakeForm.brandAssets.
 */

const ALLEGIANT_BRAND = Object.freeze({
  colors: {
    violet: '#6D3BF7',
    deepPurple: '#361E5E',
    mint: '#8FFFCE',
    navy: '#001423',
  },
  fonts: {
    logo: 'Venera',
    titles: 'MicroSquare Extended',
    body: 'Poppins',
    bodyFallback: 'Inter',
  },
  terminology: {
    partner: 'partner',
    partnerPlural: 'partners',
    // Never "client" or "clients" — see Gauntlet brand-sensitive term audit.
  },
});

module.exports = { ALLEGIANT_BRAND };
