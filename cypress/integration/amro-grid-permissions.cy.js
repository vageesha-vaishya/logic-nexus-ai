describe('AMRO Grid CRUD Permission Guardrails', () => {
  it('enforces ReadOnly role restrictions', () => {
    cy.visit('http://localhost:6007/?path=/story/amro-templates-amroinventorydatagridtemplate--read-only-role');

    cy.contains('Record Detail').should('be.visible');
    cy.get('button[aria-label="Create record"]').should('be.disabled');
    cy.get('button[aria-label="Read record"]').should('not.be.disabled');
    cy.get('button[aria-label="Update record"]').should('be.disabled');
    cy.get('button[aria-label="Delete record"]').should('be.disabled');
    cy.get('button[aria-label="Save record"]').should('be.disabled');
  });

  it('enforces Editor role restrictions while allowing update/save', () => {
    cy.visit('http://localhost:6007/?path=/story/amro-templates-amroinventorydatagridtemplate--editor-role');

    cy.contains('Record Detail').should('be.visible');
    cy.get('button[aria-label="Create record"]').should('not.be.disabled');
    cy.get('button[aria-label="Update record"]').should('not.be.disabled').click({ force: true });
    cy.get('button[aria-label="Save record"]').should('not.be.disabled').click({ force: true });
    cy.get('button[aria-label="Delete record"]').should('be.disabled');
  });
});
