import test from 'node:test';
import assert from 'node:assert/strict';

import { filterContacts } from './contactFilters.js';

test('filterContacts combines status and keyword search', () => {
  const items = [
    {
      contact_id: 1,
      name: 'สมศรี คงดี',
      email: 'somsee@example.com',
      subject: 'คำถามเรื่องการชำระเงิน',
      category: 'payment',
      status: 'new',
    },
    {
      contact_id: 2,
      name: 'นภา ทองคำ',
      email: 'napa@example.com',
      subject: 'เรื่องการจัดส่ง',
      category: 'shipping',
      status: 'resolved',
    },
  ];

  assert.deepEqual(filterContacts(items, { status: 'all', search: 'ชำระเงิน' }), [items[0]]);
  assert.deepEqual(filterContacts(items, { status: 'resolved', search: '' }), [items[1]]);
  assert.deepEqual(filterContacts(items, { status: 'new', search: 'napa' }), []);
});
