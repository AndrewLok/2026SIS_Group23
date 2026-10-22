package com.voyager.backend.fuel;

// What a fuel leg costs. This is the same sum, in the same order, as costCentsFor and litresFor in
// the frontend's lib/fuel.ts, and the two have to stay in step: the screen shows its own figure
// while the form is being filled in, and the server's is the one that is charged.
//
//   litres = distance * efficiency / 100
//   cost   = litres * price per litre, rounded to whole cents once, at the end
//
// Both sides use IEEE doubles and round halves up (Math.round in each), so they agree to the cent.

public final class FuelCost {

    private FuelCost() {}

    public static double litres(double distanceKm, double efficiencyL100km) {
        return (distanceKm * efficiencyL100km) / 100;
    }

    public static long costCents(double distanceKm, double efficiencyL100km, int pricePerLitreCents) {
        return Math.round(litres(distanceKm, efficiencyL100km) * pricePerLitreCents);
    }
}
