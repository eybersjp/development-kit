/**
 * Development Kit Intelligence — Memory Provider Contract
 *
 * Defines the standard abstract interface for DK Memory Providers.
 */

export class DKProvider {
  async detect() {
    throw new Error('detect() not implemented');
  }

  async health() {
    throw new Error('health() not implemented');
  }

  async capabilities() {
    throw new Error('capabilities() not implemented');
  }

  async activate(context) {
    throw new Error('activate() not implemented');
  }

  async deactivate(context) {
    throw new Error('deactivate() not implemented');
  }
}

export class DKMemoryProvider extends DKProvider {
  async store(record) {
    throw new Error('store() not implemented');
  }

  async get(id) {
    throw new Error('get() not implemented');
  }

  async query(query) {
    throw new Error('query() not implemented');
  }

  async update(record, options) {
    throw new Error('update() not implemented');
  }

  async archive(id) {
    throw new Error('archive() not implemented');
  }

  async forget(id) {
    throw new Error('forget() not implemented');
  }

  async supersede(oldId, newRecord) {
    throw new Error('supersede() not implemented');
  }

  async export(options) {
    throw new Error('export() not implemented');
  }

  async import(archive, options) {
    throw new Error('import() not implemented');
  }

  async rebuildIndex() {
    throw new Error('rebuildIndex() not implemented');
  }
}
