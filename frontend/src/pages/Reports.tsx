import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { TrendingUp, DollarSign, ShoppingCart, Clock, CalendarDays, PieChart as PieIcon, BarChart3, Download, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { PeriodSelector, getPeriodDates, type Period } from '@/components/PeriodSelector';
import { MetricCardWithChange } from '@/components/MetricCardWithChange';
import { useOutlet } from '@/contexts/OutletContext';
import { exportMultiSheet } from '@/lib/export-excel';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export function Reports() {
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const periodDates = getPeriodDates(period, customFrom, customTo);
  const { outletId } = useOutlet();

  const queryParams = { date_from: periodDates.from, date_to: periodDates.to, outlet_id: outletId };

  // Sales Summary
  const { data: salesSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['sales-summary', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getSalesSummary({ ...queryParams, include_returns: true });
      return response.data;
    },
  });

  // Sales Comparison (for % change)
  const { data: salesComparison } = useQuery({
    queryKey: ['sales-comparison-reports', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getSalesComparison(queryParams);
      return response.data;
    },
  });

  // Top Products
  const { data: topProducts, isLoading: loadingTop } = useQuery({
    queryKey: ['top-products', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getTopSellingProducts({ ...queryParams, limit: 10 });
      return response.data;
    },
  });

  // Hourly Sales
  const { data: hourlySales, isLoading: loadingHourly } = useQuery({
    queryKey: ['hourly-sales', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getHourlySales(queryParams);
      return response.data;
    },
  });

  // Weekday Sales
  const { data: weekdaySales, isLoading: loadingWeekday } = useQuery({
    queryKey: ['weekday-sales', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getWeekdaySales(queryParams);
      return response.data;
    },
  });

  // Category Sales
  const { data: categorySales, isLoading: loadingCategory } = useQuery({
    queryKey: ['category-sales', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getCategorySales(queryParams);
      return response.data;
    },
  });

  // Monthly Sales
  const { data: monthlySales, isLoading: loadingMonthly } = useQuery({
    queryKey: ['monthly-sales', periodDates.from, periodDates.to],
    queryFn: async () => {
      const response = await apiClient.getMonthlySales(queryParams);
      return response.data;
    },
  });

  const changes = salesComparison?.changes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes de Ventas</h1>
          <p className="text-gray-500 mt-1">Analisis profundo de ventas por periodo</p>
        </div>
        <button
          onClick={() => {
            const sheets = [];
            if (topProducts?.length) sheets.push({ name: 'Top Productos', data: topProducts });
            if (hourlySales?.length) sheets.push({ name: 'Ventas por Hora', data: hourlySales });
            if (weekdaySales?.length) sheets.push({ name: 'Ventas por Dia', data: weekdaySales });
            if (categorySales?.length) sheets.push({ name: 'Ventas por Categoria', data: categorySales });
            if (monthlySales?.length) sheets.push({ name: 'Tendencia Mensual', data: monthlySales });
            if (sheets.length > 0) {
              exportMultiSheet(sheets, `reporte-ventas-${periodDates.from}-a-${periodDates.to}`);
            }
          }}
          disabled={!topProducts?.length}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingSummary ? (
          <div className="col-span-3 text-center py-8 text-gray-500">Cargando resumen...</div>
        ) : salesSummary ? (
          <>
            <MetricCardWithChange
              title="Ventas Totales"
              value={`$${(salesSummary.totals?.amount ?? 0).toLocaleString()}`}
              change={changes?.amount}
              icon={DollarSign}
              color="green"
            />
            <MetricCardWithChange
              title="Transacciones"
              value={(salesSummary.totals?.tickets ?? 0).toLocaleString()}
              change={changes?.tickets}
              icon={ShoppingCart}
              color="blue"
            />
            <MetricCardWithChange
              title="Ticket Promedio"
              value={`$${(salesSummary.totals?.avg_ticket ?? 0).toLocaleString()}`}
              change={changes?.avg_ticket}
              icon={TrendingUp}
              color="purple"
            />
          </>
        ) : null}
      </div>

      {/* Top Products */}
      <ChartCard title="Top 10 Productos Mas Vendidos" icon={BarChart3} loading={loadingTop}>
        {topProducts && topProducts.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: any, name?: string) => [name === 'Ingreso' ? `$${value.toLocaleString()}` : value, name ?? '']} />
                <Legend />
                <Bar yAxisId="left" dataKey="quantity" fill="#8b5cf6" name="Cantidad" />
                <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Ingreso" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingreso</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Prom.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProducts.map((product: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{product.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${product.revenue?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        ${product.quantity > 0 ? (product.revenue / product.quantity).toFixed(2) : '0'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{product.variants ?? 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ChartCard>

      {/* 2x2 Grid: Hourly, Weekday, Category, Monthly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Sales */}
        <ChartCard title="Ventas por Hora del Dia" icon={Clock} loading={loadingHourly}>
          {hourlySales && hourlySales.length > 0 && (() => {
            const storeHours = hourlySales.filter((h: any) => h.hour >= 8 && h.hour <= 22);
            return (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={storeHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: any, name?: string) => [
                    name === 'Ventas' ? `$${value.toLocaleString()}` : value,
                    name ?? '',
                  ]}
                  labelFormatter={(h) => `${h}:00 - ${h}:59`}
                />
                <Bar dataKey="amount" fill="#8b5cf6" name="Ventas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            );
          })()}
        </ChartCard>

        {/* Weekday Sales */}
        <ChartCard title="Ventas por Dia de la Semana" icon={CalendarDays} loading={loadingWeekday}>
          {weekdaySales && weekdaySales.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weekdaySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: any, name?: string) => [
                    name === 'Ventas' ? `$${value.toLocaleString()}` : value,
                    name ?? '',
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="amount" fill="#10b981" name="Ventas" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="tickets" fill="#3b82f6" name="Tickets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category Sales by Revenue */}
        <ChartCard title="Productos por Ingreso" icon={PieIcon} loading={loadingCategory}>
          {categorySales && categorySales.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categorySales}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${(name ?? '').substring(0, 18)}${(name ?? '').length > 18 ? '...' : ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  dataKey="revenue"
                  nameKey="name"
                >
                  {categorySales.map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ingreso']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category Sales by Quantity */}
        <ChartCard title="Productos por Cantidad" icon={Package} loading={loadingCategory}>
          {categorySales && categorySales.length > 0 && (() => {
            const sortedByQty = [...categorySales].sort((a: any, b: any) => b.quantity - a.quantity);
            return (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sortedByQty}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(name ?? '').substring(0, 18)}${(name ?? '').length > 18 ? '...' : ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="quantity"
                    nameKey="name"
                  >
                    {sortedByQty.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value.toLocaleString(), 'Cantidad']} />
                </PieChart>
              </ResponsiveContainer>
            );
          })()}
        </ChartCard>

        {/* Monthly Trend */}
        <ChartCard title="Tendencia Mensual" icon={TrendingUp} loading={loadingMonthly}>
          {monthlySales && monthlySales.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: any, name?: string) => [`$${value.toLocaleString()}`, name ?? '']}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="Ventas" dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="avg_ticket" stroke="#8b5cf6" strokeWidth={2} name="Ticket Prom." dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, loading, children }: {
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
