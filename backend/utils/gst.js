const GST_STATE_OPTIONS = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Other Country' },
];

const GST_REGISTRATION_TYPES = [
  'Regular',
  'Composition',
  'Unregistered',
  'SEZ',
  'Exempted',
  'Consumer',
];

const normaliseText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const padStateCode = (value) => String(value || '').trim().padStart(2, '0');

const getStateByCode = (code) => GST_STATE_OPTIONS.find((state) => state.code === padStateCode(code));

const getStateByName = (name) => GST_STATE_OPTIONS.find((state) => normaliseText(state.name) === normaliseText(name));

const getStateCodeByName = (name) => getStateByName(name)?.code || '';

const getStateNameByCode = (code) => getStateByCode(code)?.name || '';

const isValidGstin = (value) => {
  if (!value) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value).trim().toUpperCase());
};

const getGstinStateCode = (value) => {
  if (!isValidGstin(value)) return '';
  return String(value).trim().toUpperCase().slice(0, 2);
};

const isValidPan = (value) => {
  if (!value) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).trim().toUpperCase());
};

const getCompanyStateFromSettings = (settings) => {
  const gstin = String(settings?.gstDetails || '').trim().toUpperCase();
  const stateCode = getGstinStateCode(gstin);
  return {
    stateCode,
    stateName: getStateNameByCode(stateCode),
  };
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const calculatePurchaseTotals = ({ items = [], supplierStateCode = '', companyStateCode = '', supplierGstType = '' } = {}) => {
  let subtotal = 0;
  let taxTotal = 0;

  const isUnregistered = supplierGstType === 'Unregistered' || !supplierStateCode;

  items.forEach((item) => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const gstPercent = isUnregistered ? 0 : (Number(item.gstPercent) || 0);
    const baseAmount = qty * unitPrice;
    subtotal += baseAmount;
    taxTotal += (baseAmount * gstPercent) / 100;
  });

  const normalizedSupplierStateCode = padStateCode(supplierStateCode);
  const normalizedCompanyStateCode = padStateCode(companyStateCode);
  const isIntraState = Boolean(
    !isUnregistered &&
      normalizedSupplierStateCode &&
      normalizedCompanyStateCode &&
      normalizedSupplierStateCode === normalizedCompanyStateCode
  );

  const roundedSubtotal = roundMoney(subtotal);
  const roundedTaxTotal = isUnregistered ? 0 : roundMoney(taxTotal);
  const roundedGrandTotal = roundMoney(roundedSubtotal + roundedTaxTotal);
  const cgstAmount = isIntraState ? roundMoney(roundedTaxTotal / 2) : 0;
  const sgstAmount = isIntraState ? roundMoney(roundedTaxTotal / 2) : 0;
  const igstAmount = (!isUnregistered && !isIntraState) ? roundMoney(roundedTaxTotal) : 0;

  return {
    subtotal: roundedSubtotal,
    taxTotal: roundedTaxTotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxType: roundedTaxTotal > 0 ? (isIntraState ? 'CGST + SGST' : 'IGST') : 'No GST',
    taxRate: roundedSubtotal > 0 ? roundMoney((roundedTaxTotal / roundedSubtotal) * 100) : 0,
    grandTotal: roundedGrandTotal,
    isIntraState,
  };
};

module.exports = {
  GST_STATE_OPTIONS,
  GST_REGISTRATION_TYPES,
  getStateCodeByName,
  getStateNameByCode,
  getStateByCode,
  getStateByName,
  isValidGstin,
  getGstinStateCode,
  isValidPan,
  getCompanyStateFromSettings,
  calculatePurchaseTotals,
  roundMoney,
};
