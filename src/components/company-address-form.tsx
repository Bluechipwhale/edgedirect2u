'use client';
import { MapPin } from 'lucide-react';
import { usePlatformAction } from './platform-actions';
import type { Company } from '@/lib/platform-contract';

export function CompanyAddressForm({ company }: { company: Company }) {
  const { busy, message, submit } = usePlatformAction();
  return <form className="company-address-form" aria-label={`${company.name} address settings`} onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit({ action: 'company-address', company_id: company.id, address: form.get('address') });
  }}>
    <label>Company address
      <textarea name="address" defaultValue={company.address || ''} maxLength={500} rows={3}
        autoComplete="street-address" placeholder="Street address, city, state and country" />
      <small>The physical business address. You can update it here whenever it changes.</small>
    </label>
    <button className="small-button" disabled={busy}><MapPin size={15} />{busy ? 'Saving…' : 'Save address'}</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}
