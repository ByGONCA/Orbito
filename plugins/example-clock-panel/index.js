/**
 * Orbito Example Clock Plugin
 */
module.exports = {
  activate(context) {
    context.log('[example-clock] Workspace Time & Productivity Clock activated!');

    if (context.notifications) {
      context.notifications.show('Productivity Clock extension ready', 'info');
    }
  },

  deactivate() {
    console.log('[example-clock] Deactivated.');
  }
};
