document.getElementById('openBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'index.html' });
});
