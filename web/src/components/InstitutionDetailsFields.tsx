/* eslint-disable react-refresh/only-export-components -- the value type and
   EMPTY_INSTITUTION_DETAILS constant travel with the component so every
   consumer has a single import path */
import { useTranslation } from 'react-i18next';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface InstitutionDetailsValue {
  name: string;
  shortName: string;
  address: string;
  director: string;
}

export type InstitutionDetailField = keyof InstitutionDetailsValue;

export const EMPTY_INSTITUTION_DETAILS: InstitutionDetailsValue = {
  name: '',
  shortName: '',
  address: '',
  director: '',
};

interface InstitutionDetailsFieldsProps {
  value: InstitutionDetailsValue;
  onChange: (next: InstitutionDetailsValue) => void;
  /** Which fields to render; defaults to all four. */
  fields?: readonly InstitutionDetailField[];
  nameRequired?: boolean;
  autoFocusName?: boolean;
  /** Keeps DOM ids unique when more than one dialog mounts the component. */
  idPrefix?: string;
}

/**
 * Controlled, presentational institution detail fields (name, short name,
 * address, director) shared by the workspace dialogs, the migration flow and
 * Settings, so the field sets never drift apart. It owns no persistence and
 * no concept of institution type.
 */
export function InstitutionDetailsFields({
  value,
  onChange,
  fields,
  nameRequired = false,
  autoFocusName = false,
  idPrefix = 'institution',
}: InstitutionDetailsFieldsProps) {
  const { t } = useTranslation();
  const show = (field: InstitutionDetailField) => !fields || fields.includes(field);

  return (
    <>
      {show('name') && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-name`}>
            {t('institutionDetails.nameLabel', 'Назва закладу')}
          </Label>
          <Input
            id={`${idPrefix}-name`}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder={t('institutionDetails.namePlaceholder', 'напр., Ліцей №15 м. Києва')}
            required={nameRequired}
            autoFocus={autoFocusName}
          />
        </div>
      )}
      {show('shortName') && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-shortName`}>
            {t('institutionDetails.shortNameLabel', 'Скорочена назва (необовʼязково)')}
          </Label>
          <Input
            id={`${idPrefix}-shortName`}
            value={value.shortName}
            onChange={(e) => onChange({ ...value, shortName: e.target.value })}
            placeholder={t('institutionDetails.shortNamePlaceholder', 'напр., Ліцей 15')}
          />
        </div>
      )}
      {show('address') && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-address`}>
            {t('institutionDetails.addressLabel', 'Адреса (необовʼязково)')}
          </Label>
          <Input
            id={`${idPrefix}-address`}
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder={t('institutionDetails.addressPlaceholder', 'напр., м. Київ, вул. Шевченка, 1')}
          />
        </div>
      )}
      {show('director') && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-director`}>
            {t('institutionDetails.directorLabel', 'Директор (необовʼязково)')}
          </Label>
          <Input
            id={`${idPrefix}-director`}
            value={value.director}
            onChange={(e) => onChange({ ...value, director: e.target.value })}
            placeholder={t('institutionDetails.directorPlaceholder', 'напр., Шевченко І. І.')}
          />
        </div>
      )}
    </>
  );
}
