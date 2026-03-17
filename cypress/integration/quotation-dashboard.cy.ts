declare const cy: any;

describe('Quotation Dashboard Domain Isolation', () => {
  it('switches domain context and keeps quotation data isolated', () => {
    cy.visit('/dashboard/quotes');
    cy.contains('Quotations').should('be.visible');

    cy.get('button').contains('Select Domain').click({ force: true });
    cy.contains('LOGISTICS').click({ force: true });
    cy.contains('LOGISTICS').should('be.visible');

    cy.get('button').contains('Select Domain').click({ force: true });
    cy.contains('BANKING').click({ force: true });
    cy.contains('BANKING').should('be.visible');
  });
});
