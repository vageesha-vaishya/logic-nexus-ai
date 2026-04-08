describe('Module Layout v2.3 Integration Flow', () => {
  it('executes Grid -> Detail -> CRUD -> Event Stream -> Checklist flow', () => {
    cy.visit('http://localhost:6006/?path=/story/amro-templates-amroinventorydatagridtemplate--desktop1366validation');

    cy.contains('Inventory Data Grid').should('exist');

    // Grid row selection
    cy.get('[role="grid"] [role="row"]').eq(2).click({ force: true });
    cy.contains('Record Detail').should('be.visible');

    // CRUD event action buttons (icon action bar in detail panel)
    cy.get('button[aria-label="Update record"]').click({ force: true });
    cy.get('button[aria-label="Save record"]').click({ force: true });

    // Event stream and CRUD logs visible in Storybook wrapper
    cy.contains('CRUD Events').should('be.visible');
    cy.contains('crud:').should('exist');

    // Viewport checklist block visible
    cy.contains('Viewport Validation Checklist').should('be.visible');
  });
});
