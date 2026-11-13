/**
 * server/utils/fsiResolver.ts
 *
 * Dynamic Freight Fuel Surcharge Indexation (FSI) Multiplier Engine.
 * 
 * Automatically resolves dynamic transport contracts, long-haul FTL rates,
 * and secondary redistribution freights against fluctuating diesel prices (IOCL/BPCL benchmarks).
 *
 * Mathematical Core:
 *   Fuel Impact Ratio (deltaFuel) = (Current_Price - Base_Price) / Base_Price
 *   FSI_Multiplier = 1 + (deltaFuel * Fuel_Sensitivity_Factor [alpha])
 *   Effective_Rate = (Base_Freight * FSI_Multiplier) + Toll_Additions + Green_Cess
 */

export interface FSIRouteConfig {
  routeId: string;
  origin: string;
  destination: string;
  distanceKm: number;
  baseFreightRate: number; // Base rate in INR (per trip or per MT)
  rateBasis: 'PER_TRIP' | 'PER_MT' | 'PER_CFT';
  baselineDieselPrice: number; // Contractual benchmark diesel price in INR/L (e.g. 90.00)
  fuelSensitivityFactor?: number; // alpha: default 0.40 (40% fuel cost component)
  fixedTollCharges?: number; // Pre-calculated NHAI Fastag toll per trip
  greenCessPerTrip?: number; // Municipal or state green cess
  applicableGSTRate?: number; // Usually 5% under RCM (Reverse Charge) or 12% Forward Charge
}

export interface FSIResolutionInput {
  routeConfig: FSIRouteConfig;
  currentDieselPrice: number; // Current prevailing pump price in INR/L
  payloadWeightMt?: number; // Actual loaded metric tonnage for PER_MT rates
  volumeCft?: number; // Actual loaded cubic feet for PER_CFT rates
  isRCMApplicable?: boolean; // True if recipient pays 5% GST under Reverse Charge Mechanism
}

export interface FSIResolutionResult {
  routeId: string;
  origin: string;
  destination: string;
  baseFreight: number;
  baselineDieselPrice: number;
  currentDieselPrice: number;
  dieselPriceVariance: number;
  dieselPercentageChange: number;
  fuelSensitivityFactor: number;
  fsiMultiplier: number;
  fuelSurchargeAmount: number;
  adjustedFreightBeforeAddons: number;
  tollCharges: number;
  greenCess: number;
  subtotalTaxableFreight: number;
  gstRate: number;
  gstAmount: number;
  isRCM: boolean;
  totalLandedFreight: number;
  effectiveRatePerUnit: number;
  calculatedAt: string;
}

/**
 * Resolves landed freight rate applying dynamic fuel surcharge indexation.
 */
export function resolveFreightFSI(input: FSIResolutionInput): FSIResolutionResult {
  const { routeConfig, currentDieselPrice, payloadWeightMt, volumeCft, isRCMApplicable = true } = input;
  
  const baseRate = routeConfig.baseFreightRate;
  const baseDiesel = routeConfig.baselineDieselPrice > 0 ? routeConfig.baselineDieselPrice : 90.0;
  const alpha = routeConfig.fuelSensitivityFactor !== undefined ? routeConfig.fuelSensitivityFactor : 0.40;
  const toll = routeConfig.fixedTollCharges || 0;
  const greenCess = routeConfig.greenCessPerTrip || 0;
  const gstRate = routeConfig.applicableGSTRate !== undefined ? routeConfig.applicableGSTRate : (isRCMApplicable ? 0.05 : 0.12);

  // 1. Calculate Quantity Base Multiplier
  let units = 1;
  if (routeConfig.rateBasis === 'PER_MT' && payloadWeightMt) {
    units = Math.max(0.01, payloadWeightMt);
  } else if (routeConfig.rateBasis === 'PER_CFT' && volumeCft) {
    units = Math.max(0.01, volumeCft);
  }
  const totalBaseFreight = baseRate * units;

  // 2. Diesel Price Variance & Indexation
  const dieselPriceVariance = currentDieselPrice - baseDiesel;
  const dieselPercentageChange = (dieselPriceVariance / baseDiesel);
  
  // FSI Multiplier formula: 1 + (deltaDiesel% * alpha)
  const fsiMultiplier = 1 + (dieselPercentageChange * alpha);
  const adjustedFreightBeforeAddons = totalBaseFreight * fsiMultiplier;
  const fuelSurchargeAmount = adjustedFreightBeforeAddons - totalBaseFreight;

  // 3. Add-ons & Statutory Taxes
  const subtotalTaxableFreight = adjustedFreightBeforeAddons + toll + greenCess;
  const gstAmount = subtotalTaxableFreight * gstRate;
  const totalLandedFreight = subtotalTaxableFreight + (isRCMApplicable ? 0 : gstAmount);
  const effectiveRatePerUnit = totalLandedFreight / units;

  return {
    routeId: routeConfig.routeId,
    origin: routeConfig.origin,
    destination: routeConfig.destination,
    baseFreight: Math.round(totalBaseFreight * 100) / 100,
    baselineDieselPrice: baseDiesel,
    currentDieselPrice,
    dieselPriceVariance: Math.round(dieselPriceVariance * 100) / 100,
    dieselPercentageChange: Math.round(dieselPercentageChange * 10000) / 100, // as percentage with 2 decimals
    fuelSensitivityFactor: alpha,
    fsiMultiplier: Math.round(fsiMultiplier * 10000) / 10000,
    fuelSurchargeAmount: Math.round(fuelSurchargeAmount * 100) / 100,
    adjustedFreightBeforeAddons: Math.round(adjustedFreightBeforeAddons * 100) / 100,
    tollCharges: toll,
    greenCess,
    subtotalTaxableFreight: Math.round(subtotalTaxableFreight * 100) / 100,
    gstRate: gstRate * 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    isRCM: isRCMApplicable,
    totalLandedFreight: Math.round(totalLandedFreight * 100) / 100,
    effectiveRatePerUnit: Math.round(effectiveRatePerUnit * 100) / 100,
    calculatedAt: new Date().toISOString()
  };
}
