package com.voyager.backend.expense.responseDTO;

import java.util.List;

import com.voyager.backend.expense.SettlementCalculator.Balance;
import com.voyager.backend.expense.SettlementCalculator.Transfer;

public record BalancesResponse(
        List<Balance> balances,
        List<Transfer> transfers
) {}
