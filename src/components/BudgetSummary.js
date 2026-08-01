'use client';

export default function BudgetSummary({ budget, userBudget }) {
  if (!budget) return null;

  const formatCost = (cost) => new Intl.NumberFormat('id-ID').format(cost);

  const computedTotal = [
    Number(budget.tiket_wisata) || 0,
    Number(budget.kuliner) || 0,
    Number(budget.transportasi) || 0,
    Number(budget.oleh_oleh) || 0,
  ].reduce((sum, value) => sum + value, 0);

  const totalCost = Number.isFinite(Number(budget.total)) && Number(budget.total) > 0
    ? Number(budget.total)
    : computedTotal;

  const percentage = userBudget > 0 ? Math.round((totalCost / userBudget) * 100) : 0;
  const remaining = userBudget - totalCost;

  const getProgressClass = () => {
    if (percentage > 90) return 'over';
    if (percentage > 70) return 'warn';
    return 'safe';
  };

  const getRemainingClass = () => {
    if (remaining < 0) return 'danger';
    if (percentage > 70) return 'warning';
    return '';
  };

  const breakdownItems = [
    { icon: '🎫', label: 'Tiket Wisata', value: budget.tiket_wisata || 0 },
    { icon: '🍖', label: 'Kuliner', value: budget.kuliner || 0 },
    { icon: '🚗', label: 'Transportasi', value: budget.transportasi || 0 },
    { icon: '🛍️', label: 'Oleh-oleh', value: budget.oleh_oleh || 0 },
  ].filter((item) => item.value > 0);

  return (
    <div className="budget-summary" id="budget-summary">
      <h3 className="budget-title">
        <span>💰</span> Ringkasan Budget
      </h3>

      {breakdownItems.map((item) => (
        <div className="budget-row" key={item.label}>
          <span className="label">
            <span>{item.icon}</span> {item.label}
          </span>
          <span className="value">Rp{formatCost(item.value)}</span>
        </div>
      ))}

      <hr className="budget-divider" />

      <div className="budget-row total">
        <span className="label">Total</span>
        <span className="value">Rp{formatCost(totalCost)}</span>
      </div>

      {userBudget > 0 && (
        <div className="budget-row remaining">
          <span className="label">Sisa Budget</span>
          <span className={`value ${getRemainingClass()}`}>
            Rp{formatCost(Math.abs(remaining))} {remaining >= 0 ? '✅' : '⚠️'}
          </span>
        </div>
      )}

      <div className="budget-progress">
        <div
          className={`budget-progress-fill ${getProgressClass()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
