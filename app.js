const principalView = document.getElementById('principal-view');
const configView = document.getElementById('config-view');
const footerTabs = document.getElementById('footer-tabs');

if (principalView && configView && footerTabs) {
  const tabs = footerTabs.querySelectorAll('.tab');

  const setActiveView = (tabName) => {
    const isConfig = tabName === 'config';

    principalView.classList.toggle('view-hidden', isConfig);
    configView.classList.toggle('view-hidden', !isConfig);

    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveView(tab.dataset.tab));
  });

  setActiveView('principal');
}
