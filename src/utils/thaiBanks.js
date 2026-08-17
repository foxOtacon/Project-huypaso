export const THAI_BANKS = [
  { name: 'ธนาคารกรุงเทพ (BBL)', code: 'BBL', logo: '/images/banks/bbl.png', aliases: ['กรุงเทพ', 'BBL'] },
  { name: 'ธนาคารกสิกรไทย (KBANK)', code: 'KBANK', logo: '/images/banks/kbank.png', aliases: ['กสิกรไทย', 'KBANK'] },
  { name: 'ธนาคารกรุงไทย (KTB)', code: 'KTB', logo: '/images/banks/ktb.png', aliases: ['กรุงไทย', 'KTB'] },
  { name: 'ธนาคารกรุงศรีอยุธยา (BAY)', code: 'BAY', logo: '/images/banks/bay.png', aliases: ['กรุงศรี', 'BAY'] },
  { name: 'ธนาคารไทยพาณิชย์ (SCB)', code: 'SCB', logo: '/images/banks/scb.png', aliases: ['ไทยพาณิชย์', 'SCB'] },
  { name: 'ธนาคารทหารไทยธนชาต (ttb)', code: 'TTB', logo: '/images/banks/ttb.png', aliases: ['ทหารไทยธนชาต', 'ทีเอ็มบีธนชาต', 'TTB'] },
  { name: 'ธนาคารออมสิน (GSB)', code: 'GSB', logo: '/images/banks/gsb.png', aliases: ['ออมสิน', 'GSB'] },
  { name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส. / BAAC)', code: 'BAAC', logo: '/images/banks/baac.png', aliases: ['ธ.ก.ส.', 'เพื่อการเกษตร', 'BAAC'] },
  { name: 'ธนาคารเกียรตินาคินภัทร (KKP)', code: 'KKP', logo: '/images/banks/kkp.png', aliases: ['เกียรตินาคิน', 'KKP'] },
  { name: 'ธนาคารซีไอเอ็มบี ไทย (CIMB Thai)', code: 'CIMB', logo: '/images/banks/cimb.png', aliases: ['ซีไอเอ็มบี', 'CIMB'] },
  { name: 'ธนาคารยูโอบี ประเทศไทย (UOB)', code: 'UOB', logo: '/images/banks/uob.png', aliases: ['ยูโอบี', 'UOB'] },
  { name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)', code: 'LHB', logo: '/images/banks/lhb.png', aliases: ['แลนด์ แอนด์ เฮ้าส์', 'LH Bank', 'LHB'] },
  { name: 'ธนาคารไอซีบีซี (ไทย) (ICBC Thai)', code: 'ICBC', logo: '/images/banks/icbc.png', aliases: ['ไอซีบีซี', 'ICBC'] },
];

function normalizeBankName(value) {
  return String(value || '').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');
}

export function findThaiBank(bankName) {
  const normalizedName = normalizeBankName(bankName);
  if (!normalizedName) return null;

  return THAI_BANKS.find((bank) => normalizeBankName(bank.name) === normalizedName)
    || THAI_BANKS.find((bank) => bank.aliases.some((alias) => normalizedName.includes(normalizeBankName(alias))))
    || null;
}
