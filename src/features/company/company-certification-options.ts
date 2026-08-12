export interface CertificationOption {
  id: string;
  name: string;
  issuingBody: string;
  required: boolean;
}

export interface IndustryCertificationGroup {
  id: string;
  name: string;
  codePrefixes: string[];
  certifications: CertificationOption[];
}

const common: CertificationOption[] = [
  {
    id: "csd",
    name: "Central Supplier Database registration",
    issuingBody: "National Treasury",
    required: true,
  },
  {
    id: "bbbee",
    name: "B-BBEE Certificate / Affidavit",
    issuingBody: "SANAS accredited agency / Commissioner of Oaths",
    required: true,
  },
  {
    id: "tax-clearance",
    name: "Tax Compliance Status",
    issuingBody: "SARS",
    required: true,
  },
];

// Mirrors the IDs and descriptions used by the web Company Profile Builder.
export const INDUSTRY_CERTIFICATION_GROUPS: IndustryCertificationGroup[] = [
  {
    id: "construction",
    name: "Construction & Civil Engineering",
    codePrefixes: ["CE", "GB", "ME", "EP"],
    certifications: [
      {
        id: "cidb",
        name: "CIDB Contractor Grading",
        issuingBody: "CIDB",
        required: true,
      },
      {
        id: "nhbrc",
        name: "NHBRC Registration",
        issuingBody: "NHBRC",
        required: false,
      },
      {
        id: "iso9001",
        name: "ISO 9001:2015 (Quality Management)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      {
        id: "iso14001",
        name: "ISO 14001:2015 (Environmental Management)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      {
        id: "iso45001",
        name: "ISO 45001:2018 (Occupational Health & Safety)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      {
        id: "ecsa",
        name: "ECSA Registration",
        issuingBody: "Engineering Council of SA",
        required: false,
      },
    ],
  },
  {
    id: "ict",
    name: "Information & Communication Technology",
    codePrefixes: ["ICT"],
    certifications: [
      {
        id: "popia",
        name: "POPIA Compliance",
        issuingBody: "Information Regulator",
        required: true,
      },
      {
        id: "iitpsa",
        name: "IITPSA Membership",
        issuingBody: "Institute of IT Professionals SA",
        required: false,
      },
      {
        id: "iso27001",
        name: "ISO 27001 (Information Security Management)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      {
        id: "iso20000",
        name: "ISO 20000 (IT Service Management)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      { id: "cissp", name: "CISSP", issuingBody: "ISC2", required: false },
    ],
  },
  {
    id: "professional-services",
    name: "Professional Services & Consulting",
    codePrefixes: ["PS"],
    certifications: [
      {
        id: "ca-sa",
        name: "CA(SA) - Chartered Accountant",
        issuingBody: "SAICA",
        required: false,
      },
      { id: "pmp", name: "PMI-PMP", issuingBody: "PMI", required: false },
      {
        id: "prince2",
        name: "Prince2 Practitioner",
        issuingBody: "AXELOS",
        required: false,
      },
    ],
  },
  {
    id: "security",
    name: "Security Services",
    codePrefixes: ["SEC"],
    certifications: [
      {
        id: "psira",
        name: "PSIRA Registration",
        issuingBody: "PSIRA",
        required: true,
      },
      {
        id: "saidsa",
        name: "SAIDSA Accreditation",
        issuingBody: "SAIDSA",
        required: false,
      },
    ],
  },
  {
    id: "cleaning",
    name: "Cleaning & Hygiene Services",
    codePrefixes: ["CHS"],
    certifications: [
      {
        id: "coida",
        name: "COIDA Compliance",
        issuingBody: "Department of Employment and Labour",
        required: true,
      },
      {
        id: "sabs1674",
        name: "SABS 1674 (SA Cleaning Standard)",
        issuingBody: "SABS",
        required: false,
      },
      {
        id: "pcasa",
        name: "PCASA Membership",
        issuingBody: "Pest Control Association of SA",
        required: false,
      },
    ],
  },
  {
    id: "transport",
    name: "Transport & Logistics",
    codePrefixes: ["TL"],
    certifications: [
      {
        id: "rtms",
        name: "Road Transport Management System",
        issuingBody: "RTMS",
        required: false,
      },
      {
        id: "iso28000",
        name: "ISO 28000 (Supply Chain Security)",
        issuingBody: "SABS/ISO",
        required: false,
      },
      {
        id: "haccp-transport",
        name: "HACCP Certification (Food Transport)",
        issuingBody: "Various",
        required: false,
      },
    ],
  },
  {
    id: "catering",
    name: "Catering & Event Management",
    codePrefixes: ["CEM"],
    certifications: [
      {
        id: "food-safety",
        name: "Food Safety Certification",
        issuingBody: "Health Department",
        required: true,
      },
      {
        id: "coa",
        name: "Certificate of Acceptability",
        issuingBody: "Municipal Health",
        required: true,
      },
      {
        id: "haccp",
        name: "HACCP Certification",
        issuingBody: "Various",
        required: false,
      },
    ],
  },
  {
    id: "healthcare",
    name: "Healthcare & Medical Services",
    codePrefixes: ["HMS"],
    certifications: [
      {
        id: "hpcsa",
        name: "HPCSA Registration",
        issuingBody: "Health Professions Council of SA",
        required: true,
      },
      {
        id: "sanc",
        name: "SANC Registration",
        issuingBody: "SA Nursing Council",
        required: false,
      },
      {
        id: "sapc",
        name: "SAPC Registration",
        issuingBody: "SA Pharmacy Council",
        required: false,
      },
    ],
  },
  {
    id: "education",
    name: "Education & Training",
    codePrefixes: ["ET"],
    certifications: [
      {
        id: "seta",
        name: "SETA Accreditation",
        issuingBody: "Relevant SETA",
        required: true,
      },
      {
        id: "qcto",
        name: "QCTO Accreditation",
        issuingBody: "QCTO",
        required: false,
      },
      {
        id: "assessor",
        name: "Assessor Registration",
        issuingBody: "SETA",
        required: false,
      },
    ],
  },
  {
    id: "engineering",
    name: "Engineering Services",
    codePrefixes: ["ES"],
    certifications: [
      {
        id: "ecsa-preng",
        name: "Professional Engineer (Pr.Eng)",
        issuingBody: "ECSA",
        required: true,
      },
      {
        id: "ecsa-techeng",
        name: "Professional Engineering Technologist",
        issuingBody: "ECSA",
        required: false,
      },
      {
        id: "cesa",
        name: "CESA Membership",
        issuingBody: "Consulting Engineers SA",
        required: false,
      },
    ],
  },
  {
    id: "manufacturing",
    name: "Manufacturing & Production",
    codePrefixes: ["MFG"],
    certifications: [
      {
        id: "gmp",
        name: "Good Manufacturing Practice",
        issuingBody: "Various",
        required: false,
      },
      {
        id: "sabs-product",
        name: "SABS Product Certification",
        issuingBody: "SABS",
        required: false,
      },
      {
        id: "nrcs",
        name: "NRCS Certification",
        issuingBody: "NRCS",
        required: false,
      },
    ],
  },
  {
    id: "environmental",
    name: "Environmental Services",
    codePrefixes: ["ENV"],
    certifications: [
      {
        id: "eapsa",
        name: "EAPSA Registration",
        issuingBody: "EAPSA",
        required: true,
      },
      {
        id: "waste-license",
        name: "Waste Management Licence",
        issuingBody: "DFFE",
        required: false,
      },
      {
        id: "sacnasp",
        name: "SACNASP Registration",
        issuingBody: "SACNASP",
        required: false,
      },
    ],
  },
  {
    id: "financial",
    name: "Financial Services",
    codePrefixes: ["FIN"],
    certifications: [
      {
        id: "saica",
        name: "SAICA Membership",
        issuingBody: "SAICA",
        required: false,
      },
      {
        id: "irba",
        name: "IRBA Registration",
        issuingBody: "IRBA",
        required: false,
      },
      { id: "fsp", name: "FSP Licence", issuingBody: "FSCA", required: false },
    ],
  },
  {
    id: "energy",
    name: "Energy & Utilities",
    codePrefixes: ["ENU"],
    certifications: [
      {
        id: "nersa",
        name: "NERSA Registration",
        issuingBody: "NERSA",
        required: false,
      },
      {
        id: "pv-greencard",
        name: "PV GreenCard",
        issuingBody: "SAPVIA",
        required: false,
      },
    ],
  },
];

export function certificationsForIndustry(industryId: string) {
  const industry = INDUSTRY_CERTIFICATION_GROUPS.find(
    (item) => item.id === industryId,
  );
  return industry ? [...industry.certifications, ...common] : common;
}

export function inferIndustry(industryCodes: string[]): string {
  const first = industryCodes[0]?.trim();
  if (!first) return "";
  const direct = INDUSTRY_CERTIFICATION_GROUPS.find(
    (item) => item.id === first,
  );
  if (direct) return direct.id;
  const upper = first.toUpperCase();
  return (
    INDUSTRY_CERTIFICATION_GROUPS.find((item) =>
      item.codePrefixes.some((prefix) => upper.startsWith(prefix)),
    )?.id ?? ""
  );
}
