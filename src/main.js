const LEGACY_STORAGE_KEY = 'football-director-save-v2';
const ACTIVE_STORAGE_KEY = 'football-director-save-v4';

const storageGetItem = Storage.prototype.getItem;
const storageSetItem = Storage.prototype.setItem;
const storageRemoveItem = Storage.prototype.removeItem;

function activeKey(key) {
  return key === LEGACY_STORAGE_KEY ? ACTIVE_STORAGE_KEY : key;
}

Storage.prototype.getItem = function getItem(key) {
  return storageGetItem.call(this, activeKey(key));
};

Storage.prototype.setItem = function setItem(key, value) {
  return storageSetItem.call(this, activeKey(key), value);
};

Storage.prototype.removeItem = function removeItem(key) {
  return storageRemoveItem.call(this, activeKey(key));
};

const { boot } = await import('./ui/controller.js');
boot();
