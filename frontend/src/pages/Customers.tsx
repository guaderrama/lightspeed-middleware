import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Users, UserPlus, UserCheck, DollarSign, RotateCcw, Download,
  Crown, ShoppingBag, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { PeriodSelector, getPeriodDates, type Period } from '@/components/PeriodSelector';
import { useOutlet } from '@/contexts/OutletContext';
import { exportMultiSheet } from '@/lib/export-excel';

const SEGMENT_COLORS = ['#8b5cf6', '#3b82f6', '#94a3b8'];

export function Customers() {
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const periodDates = getPeriodDates(period, customFrom, customTo);
  const { outletId } = useOutlet();

  const queryParams = { date_from: periodDates.from, date_to: periodDates.to, outlet_id: outletId };

  const { data: customerData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customer-analytics', periodDates.from, periodDates.to, outletId],
    queryFn: async () => {
      const response = await apiClient.getCustomerAnalytics(queryParams);
      return response.data;
    },
  });

  const { data: returnsData, isLoading: loadingReturns } = useQuery({
    queryKey: ['returns-summary', periodDates.from, periodDates.to, outletId],
    queryFn: async () => {
      const response = await apiClient.getReturnsSummary(queryParams);
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1">Inteligencia de clientes y analisis de devoluciones</p>
        </div>
        <button
          onClick={() => {
            const sheets = [];
            if (customerData?.top_customers?.length) {
              sheets.push({ name: 'Top Clientes', data: customerData.top_customers });
            }
            if (customerData?.segments?.length) {
              sheets.push({ name: 'Segmentos', data: customerData.segments });
            }
            if (returnsData?.top_returned_products?.length) {
              sheets.push({ name: 'Devoluciones', data: returnsData.top_returned_products });
            }
            if (sheets.length > 0) {
              exportMultiSheet(sheets, `clientes-${periodDates.from}-a-${periodDates.to}`);
            }
          }}
          disabled={!customerData?.top_customers?.length}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingCustomers ? (
          <div className="col-span-4 text-center py-8 text-gray-500">Cargando datos de clientes...</div>
        ) : customerData ? (
          <>
            <MetricCard
              title="Total Clientes"
              value={customerData.total_customers.toLocaleString()}
              icon={Users}
              color="blue"
            />
            <MetricCard
              title="Clientes Nuevos"
              value={customerData.new_customers.toLocaleString()}
              subtitle="1 visita en periodo"
              icon={UserPlus}
              color="green"
            />
            <MetricCard
              title="Clientes Recurrentes"
              value={customerData.returning_customers.toLocaleString()}
              subtitle="2+ visitas en periodo"
              icon={UserCheck}
              color="purple"
            />
            <MetricCard
              title="Gasto Promedio"
              value={`$${customerData.avg_spend_per_customer.toLocaleString()}`}
              subtitle="por cliente"
              icon={DollarSign}
              color="orange"
            />
          </>
        ) : null}
      </div>

      {/* Charts Row: Segmentation + Top Customers Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segmentation Pie */}
        <SectionCard title="Segmentacion de Clientes" icon={Crown} loading={loadingCustomers}>
          {customerData?.segments && customerData.segments.length > 0 && (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={customerData.segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="count"
                    nameKey="name"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {customerData.segments.map((_: any, idx: number) => (
                      <Cell key={idx} fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value, 'Clientes']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {customerData.segments.map((seg: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[idx] }} />
                      <span className="text-sm font-medium text-gray-700">{seg.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{seg.count} clientes</p>
                      <p className="text-xs text-gray-500">${seg.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Top 10 Customers Bar Chart */}
        <SectionCard title="Top 10 Clientes por Gasto" icon={ShoppingBag} loading={loadingCustomers}>
          {customerData?.top_customers && customerData.top_customers.length > 0 && (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={customerData.top_customers.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(name) => name.length > 16 ? name.substring(0, 16) + '...' : name}
                />
                <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Gasto Total']} />
                <Bar dataKey="total_spent" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Top Customers Table */}
      <SectionCard title="Tabla de Clientes" icon={Users} loading={loadingCustomers}>
        {customerData?.top_customers && customerData.top_customers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gasto Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visitas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ticket Prom.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ultima Compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customerData.top_customers.map((customer: any, idx: number) => (
                  <tr key={idx} className={idx < 3 ? 'bg-purple-50/30' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {idx < 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">
                          {idx + 1}
                        </span>
                      ) : idx + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                      ${customer.total_spent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{customer.visits}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      ${customer.avg_ticket.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {customer.last_purchase ? new Date(customer.last_purchase).toLocaleDateString('es-MX') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Returns Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Returns Metrics */}
        <SectionCard title="Resumen de Devoluciones" icon={RotateCcw} loading={loadingReturns}>
          {returnsData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tasa de Devolucion (valor)</span>
                <span className={`text-lg font-bold ${returnsData.return_rate_value > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {returnsData.return_rate_value}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Total Devuelto</span>
                <span className="text-lg font-bold text-gray-900">
                  ${returnsData.total_returns_value.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Items Devueltos</span>
                <span className="text-lg font-bold text-gray-900">
                  {returnsData.total_returns_count}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Ventas Totales</span>
                <span className="text-lg font-bold text-gray-900">
                  ${returnsData.total_sales_value.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Top Returned Products */}
        <div className="lg:col-span-2">
          <SectionCard title="Productos Mas Devueltos" icon={AlertTriangle} loading={loadingReturns}>
            {returnsData?.top_returned_products && returnsData.top_returned_products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {returnsData.top_returned_products.map((product: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{product.quantity}</td>
                        <td className="px-4 py-3 text-sm text-red-600 text-right font-semibold">
                          ${product.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">Sin devoluciones en este periodo</p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
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
