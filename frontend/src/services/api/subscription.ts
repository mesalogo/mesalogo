/**
 * 订阅管理API服务
 */
import api from './axios';

const API_BASE_URL = api.defaults.baseURL || '';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// API响应类型
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  status?: number;
}

const handleResponse = async <T = any>(response: Response): Promise<ApiResponse<T>> => {
  const data = await response.json();
  
  if (response.ok) {
    return {
      success: true,
      data: data,
      message: data.message
    };
  } else {
    return {
      success: false,
      message: data.error || data.message || '请求失败',
      status: response.status
    };
  }
};

// 订阅计划类型
export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  badge_color: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  limits: {
    max_tasks?: number;
    max_agents?: number;
    max_spaces?: number;
    max_knowledge_bases?: number;
    max_storage_mb?: number;
    max_daily_conversations?: number;
    max_monthly_tokens?: number;
  };
  features: Record<string, boolean>;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
}

// 用户订阅类型
export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'cancelled';
  is_current: boolean;
  started_at: string;
  expires_at: string | null;
  source: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

// 用量信息类型
export interface UsageItem {
  resource_type: string;
  display_name: string;
  usage: number;
  limit: number | null;
  remaining: number | null;
  percentage: number;
}

// Stripe 配置类型
export interface StripeConfig {
  enabled: boolean;
  mode: 'test' | 'live';
  publishable_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
}

// 支付记录类型
export interface PaymentRecord {
  id: string;
  user_id: string;
  type: 'subscription' | 'upgrade' | 'renewal' | 'refund';
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  plan_id: string | null;
  plan: SubscriptionPlan | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

// 支付统计类型
export interface PaymentStats {
  period: string;
  total_income: number;
  success_count: number;
  failed_count: number;
  refund_amount: number;
}

// 订阅API
export const subscriptionAPI = {
  // ==================== 用户接口 ====================
  
  /**
   * 获取当前用户订阅
   */
  async getCurrentSubscription() {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/current`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取当前订阅失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取可用计划列表
   */
  async getAvailablePlans() {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/plans`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取计划列表失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取当前用量
   */
  async getUsage() {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/usage`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取用量失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 检查配额
   */
  async checkQuota(resourceType: string, increment: number = 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/check-quota`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resource_type: resourceType, increment })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('检查配额失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  // ==================== 管理员接口 ====================

  /**
   * 管理员获取所有计划
   */
  async adminGetPlans() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/subscription-plans`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取计划列表失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 创建计划
   */
  async adminCreatePlan(planData: Partial<SubscriptionPlan>) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/subscription-plans`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(planData)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('创建计划失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 更新计划
   */
  async adminUpdatePlan(planId: string, planData: Partial<SubscriptionPlan>) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/subscription-plans/${planId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(planData)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('更新计划失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 删除计划
   */
  async adminDeletePlan(planId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/subscription-plans/${planId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('删除计划失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取用户订阅详情
   */
  async adminGetUserSubscription(userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/subscription`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取用户订阅失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 设置用户订阅
   */
  async adminUpdateUserSubscription(userId: string, data: { plan_id: string; expires_at?: string; notes?: string }) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('更新用户订阅失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 延长用户订阅
   */
  async adminExtendSubscription(userId: string, days: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/subscription/extend`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ days })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('延长订阅失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  // ==================== 用户支付历史 ====================

  /**
   * 获取当前用户的支付历史
   */
  async getPayments(page: number = 1, perPage: number = 10) {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/payments?page=${page}&per_page=${perPage}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付历史失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取支付详情
   */
  async getPaymentDetail(paymentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/payments/${paymentId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付详情失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  // ==================== 管理员 Stripe 配置 ====================

  /**
   * 获取 Stripe 配置
   */
  async adminGetStripeConfig(unmask: boolean = false) {
    try {
      const url = unmask 
        ? `${API_BASE_URL}/admin/stripe/config?unmask=true`
        : `${API_BASE_URL}/admin/stripe/config`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取 Stripe 配置失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 更新 Stripe 配置
   */
  async adminUpdateStripeConfig(config: StripeConfig) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stripe/config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('更新 Stripe 配置失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 测试 Stripe 连接
   */
  async adminTestStripeConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stripe/test`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('测试 Stripe 连接失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  // ==================== 管理员支付历史 ====================

  /**
   * 获取所有支付记录（管理员）
   */
  async adminGetPayments(params: { page?: number; per_page?: number; status?: string; type?: string; search?: string } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.status) queryParams.append('status', params.status);
      if (params.type) queryParams.append('type', params.type);
      if (params.search) queryParams.append('search', params.search);
      
      const response = await fetch(`${API_BASE_URL}/admin/payments?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付记录失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取支付详情（管理员）
   */
  async adminGetPaymentDetail(paymentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/payments/${paymentId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付详情失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取支付统计（管理员）
   */
  async adminGetPaymentStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/payments/stats`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付统计失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  // ==================== Stripe 支付流程 ====================

  /**
   * 创建 Stripe Checkout 会话
   */
  async createCheckoutSession(planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly') {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/create-checkout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ plan_id: planId, billing_period: billingPeriod })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('创建支付会话失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取 Checkout 会话状态
   */
  async getCheckoutStatus(sessionId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/checkout-status/${sessionId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取支付状态失败:', error);
      return { success: false, message: '网络错误' };
    }
  },

  /**
   * 获取 Stripe Publishable Key
   */
  async getPublishableKey() {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/publishable-key`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('获取 Publishable Key 失败:', error);
      return { success: false, message: '网络错误' };
    }
  }
};
