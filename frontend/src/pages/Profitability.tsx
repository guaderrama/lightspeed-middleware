import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  DollarSign, TrendingUp, Percent, Package, Download, BarChart3, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { PeriodSelector, getPeriodDates, type Period } from '@/components/PeriodSelector';
import { useOutlet } from '@/contexts/OutletContext';
import { exportMultiSheet } from '@/lib/export-excel';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export function Profitability() {
  const [period, setPeriod] = useState<Period>('3months');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const periodDates = getPeriodDates(period, customFrom, customTo);
  const { outletId } = useOutlet();

  const queryParams = { date_from: periodDates.from, date_to: periodDates.to, outlet_id: outletId };

  const { data: profitData, isLoading: loadingProfit } = useQuery({
    queryKey: ['profit-analysis', periodDates.from, periodDates.to, outletId],
    queryFn: async () => {
      const response = await apiClient.getProfitAnalysis(queryParams);
      return response.data;
    },
  });

  const { data: categoryData, isLoading: loadingCategory } = useQuery({
    queryKey: ['category-intelligence', periodDates.from, periodDates.to, outletId],
    queryFn: async () => {
      const response = await apiClient.getCategoryIntelligence(queryParams);
      return response.data;
    },
  });

  const totals = profitData?.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rentabilidad</h1>
          <p className="text-gray-500 mt-1">Analisis de ganancia, margenes y categorias</p>
        </div>
        <button
          onClick={() => {
            const sheets = [];
            if (profitData?.top_by_profit?.length) sheets.push({ name: 'Top Ganancia', data: profitData.top_by_profit });
            if (profitData?.by_category?.length) sheets.push({ name: 'Ganancia por Categoria', data: profitData.by_category });
            if (profitData?.best_margins?.length) sheets.push({ name: 'Mejores Margenes', data: profitData.best_margins });
            if (profitData?.worst_margins?.length) sheets.push({ name: 'Peores Margenes', data: profitData.worst_margins });
            if (categoryData?.categories?.length) sheets.push({ name: 'Inteligencia Categorias', data: categoryData.categories });
            if (sheets.length > 0) {
              exportMultiSheet(sheets, `rentabilidad-${periodDates.from}-a-${periodDates.to}`);
            }
          }}
          disabled={!profitData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      <PeriodSelector
        value={period}
        onChange={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
      />

      {/* Metric Cards */}
      {loadingProfit ? (
        <div className="text-center py-8 text-gray-500">Cargando analisis de rentabilidad...</div>
      ) : totals ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Ganancia Total"
            value={`$${totals.total_profit.toLocaleString()}`}
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title="Margen Promedio"
            value={`${totals.avg_margin_pct}%`}
            icon={Percent}
            color="purple"
          />
          <MetricCard
            title="Ingresos Totales"
            value={`$${totals.total_revenue.toLocaleString()}`}
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="Con Datos de Costo"
            value={`${totals.products_with_cost_data} / ${totals.products_with_sales}`}
            subtitle="productos con supply_price"
            icon={Package}
            color="orange"
          />
        </div>
      ) : null}

      {/* Charts: Profit by Category + Margin Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Ganancia por Categoria" icon={BarChart3} loading={loadingProfit}>
          {profitData?.by_category && profitData.by_category.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={profitData.by_category.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={140}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                />
                <Tooltip
                  formatter={(value: any, name?: string) => [`$${value.toLocaleString()}`, name ?? '']}
                />
                <Bar dataKey="total_profit" name="Ganancia" radius={[0, 4, 4, 0]}>
                  {profitData.by_category.slice(0, 10).map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Distribucion de Margenes" icon={Percent} loading={loadingProfit}>
          {profitData?.margin_distribution && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={profitData.margin_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip
                  formatter={(value: any, name?: string) => [
                    name === 'Productos' ? value : `$${value.toLocaleString()}`,
                    name ?? '',
                  ]}
                />
                <Bar dataKey="count" fill="#8b5cf6" name="Productos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Top 20 by Profit Table */}
      <SectionCard title="Top 20 Productos por Ganancia" icon={TrendingUp} loading={loadingProfit}>
        {profitData?.top_by_profit && profitData.top_by_profit.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ganancia</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profitData.top_by_profit.map((p: any, idx: number) => (
                  <tr key={p.product_id}>
                    <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 max-w-[200px] truncate">{p.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500 max-w-[120px] truncate">{p.category}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">${p.precio.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-gray-500 text-right">${p.costo.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      <span className={p.margin_pct >= 50 ? 'text-green-600 font-medium' : p.margin_pct >= 20 ? 'text-yellow-600' : 'text-red-600'}>
                        {p.margin_pct}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.quantity_sold}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-green-700 text-right">${p.total_profit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        p.abc_class === 'A' ? 'bg-green-100 text-green-800' :
                        p.abc_class === 'B' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{p.abc_class}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Best / Worst Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Mejores Margenes" icon={TrendingUp} loading={loadingProfit}>
          {profitData?.best_margins && profitData.best_margins.length > 0 && (
            <div className="space-y-2">
              {profitData.best_margins.map((p: any, idx: number) => (
                <div key={p.product_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category} | ${p.precio.toLocaleString()} - ${p.costo.toLocaleString()}</p>
                  </div>
                  <span className="ml-3 text-sm font-bold text-green-600">{p.margin_pct}%</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Peores Margenes" icon={TrendingUp} loading={loadingProfit}>
          {profitData?.worst_margins && profitData.worst_margins.length > 0 && (
            <div className="space-y-2">
              {profitData.worst_margins.map((p: any, idx: number) => (
                <div key={p.product_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category} | ${p.precio.toLocaleString()} - ${p.costo.toLocaleString()}</p>
                  </div>
                  <span className="ml-3 text-sm font-bold text-red-600">{p.margin_pct}%</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Category Intelligence Section */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Layers className="h-6 w-6 text-gray-600" />
          Inteligencia por Categoria
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Categorias por Ingreso" icon={DollarSign} loading={loadingCategory}>
          {categoryData?.categories && categoryData.categories.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryData.categories.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={140}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                />
                <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ingreso']} />
                <Bar dataKey="total_revenue" fill="#10b981" name="Ingreso" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Categorias por Ganancia" icon={TrendingUp} loading={loadingCategory}>
          {categoryData?.categories && categoryData.categories.length > 0 && (() => {
            const sorted = [...categoryData.categories].sort((a: any, b: any) => b.total_profit - a.total_profit);
            return (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sorted.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={140}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                  />
                  <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ganancia']} />
                  <Bar dataKey="total_profit" fill="#8b5cf6" name="Ganancia" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </SectionCard>
      </div>

      {/* Category Table */}
      <SectionCard title="Detalle por Categoria" icon={Layers} loading={loadingCategory}>
        {categoryData?.categories && categoryData.categories.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Productos</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingreso</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ganancia</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Inv.</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">ABC (A/B/C)</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Top Producto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categoryData.categories.map((cat: any) => (
                  <tr key={cat.category}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 max-w-[160px] truncate">{cat.category}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">{cat.product_count}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">${cat.total_revenue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm font-medium text-green-700 text-right">${cat.total_profit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      <span className={cat.avg_margin_pct >= 50 ? 'text-green-600' : cat.avg_margin_pct >= 20 ? 'text-yellow-600' : 'text-red-600'}>
                        {cat.avg_margin_pct}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 text-right">${cat.inventory_value.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-center text-gray-500">
                      {cat.abc_distribution?.A ?? 0}/{cat.abc_distribution?.B ?? 0}/{cat.abc_distribution?.C ?? 0}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 max-w-[160px] truncate">
                      {cat.top_product.name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  color: 'green' | 'purple' | 'blue' | 'orange';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, loading, children }: {
  title: string;
  icon: any;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-600" />
        {title}
      </h3>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : children ? (
        children
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">Sin datos para este periodo</p>
        </div>
      )}
    </div>
  );
}
