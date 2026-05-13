import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Button, Input, Form, Space, Radio } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface StyleConfig {
  background: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  subtitleColor: string;
  inputBg: string;
  inputBorder: string;
  buttonBg: string;
  blur?: string;
  hasAnimation?: boolean;
  animationType?: string;
}

const styles: Record<string, StyleConfig> = {
  darkTech: {
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.1)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.7)',
    inputBg: 'rgba(255, 255, 255, 0.1)',
    inputBorder: 'rgba(255, 255, 255, 0.2)',
    buttonBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  purpleBlue: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    cardBorder: 'none',
    textColor: '#1a1a2e',
    subtitleColor: '#666',
    inputBg: '#f5f5f5',
    inputBorder: '#e0e0e0',
    buttonBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  minimalWhite: {
    background: '#fafafa',
    cardBg: '#ffffff',
    cardBorder: '1px solid #e8e8e8',
    textColor: '#1a1a1a',
    subtitleColor: '#888',
    inputBg: '#f5f5f5',
    inputBorder: '#d9d9d9',
    buttonBg: '#1a1a1a',
  },
  glassmorphism: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 50%, #1e3a5f 100%)',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.2)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.7)',
    inputBg: 'rgba(255, 255, 255, 0.15)',
    inputBorder: 'rgba(255, 255, 255, 0.3)',
    buttonBg: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
    blur: 'blur(20px)',
  },
  warmGradient: {
    background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    cardBorder: 'none',
    textColor: '#2d2d2d',
    subtitleColor: '#666',
    inputBg: 'rgba(255, 255, 255, 0.8)',
    inputBorder: 'rgba(0, 0, 0, 0.1)',
    buttonBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  deepBlue: {
    background: 'linear-gradient(180deg, #0a1628 0%, #1a365d 100%)',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.6)',
    inputBg: 'rgba(255, 255, 255, 0.08)',
    inputBorder: 'rgba(255, 255, 255, 0.15)',
    buttonBg: '#3b82f6',
  },
  animatedGradient: {
    background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    cardBorder: 'none',
    textColor: '#1a1a2e',
    subtitleColor: '#666',
    inputBg: '#f5f5f5',
    inputBorder: '#e0e0e0',
    buttonBg: 'linear-gradient(135deg, #e73c7e 0%, #23a6d5 100%)',
    hasAnimation: true,
    animationType: 'gradient',
  },
  meshAnimation: {
    background: '#0a0a0a',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.1)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.6)',
    inputBg: 'rgba(255, 255, 255, 0.08)',
    inputBorder: 'rgba(255, 255, 255, 0.15)',
    buttonBg: 'linear-gradient(135deg, #00f5a0 0%, #00d9f5 100%)',
    hasAnimation: true,
    animationType: 'mesh',
  },
  aurora: {
    background: '#0f0f23',
    cardBg: 'rgba(255, 255, 255, 0.08)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.15)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.7)',
    inputBg: 'rgba(255, 255, 255, 0.1)',
    inputBorder: 'rgba(255, 255, 255, 0.2)',
    buttonBg: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
    blur: 'blur(20px)',
    hasAnimation: true,
    animationType: 'aurora',
  },
  particles: {
    background: '#1a1a2e',
    cardBg: 'rgba(255, 255, 255, 0.08)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.15)',
    textColor: '#ffffff',
    subtitleColor: 'rgba(255, 255, 255, 0.7)',
    inputBg: 'rgba(255, 255, 255, 0.1)',
    inputBorder: 'rgba(255, 255, 255, 0.2)',
    buttonBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    blur: 'blur(16px)',
    hasAnimation: true,
    animationType: 'particles',
  },
};

const styleNames: Record<string, string> = {
  darkTech: '1. 深色科技风',
  purpleBlue: '2. 紫蓝渐变',
  minimalWhite: '3. 极简白色',
  glassmorphism: '4. 玻璃拟态',
  warmGradient: '5. 暖色渐变',
  deepBlue: '6. 深蓝专业',
  animatedGradient: '7. 动态渐变',
  meshAnimation: '8. 网格动画',
  aurora: '9. 极光效果',
  particles: '10. 粒子背景',
};

const AnimatedBackground: React.FC<{ type: string }> = ({ type }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (type === 'particles' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const particleList: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];
      for (let i = 0; i < 80; i++) {
        particleList.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
        });
      }

      let frameId: number;
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particleList.forEach((p, i) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(102, 126, 234, 0.6)';
          ctx.fill();

          particleList.slice(i + 1).forEach((p2) => {
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              const alpha = 0.2 * (1 - dist / 120);
              ctx.strokeStyle = 'rgba(102, 126, 234, ' + alpha + ')';
              ctx.stroke();
            }
          });
        });
        frameId = requestAnimationFrame(animate);
      };
      animate();

      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
  }, [type]);

  if (type === 'gradient') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
          backgroundSize: '400% 400%',
          animation: 'gradientShift 15s ease infinite',
        }}
      />
    );
  }

  if (type === 'mesh') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0a0a' }}>
        <div
          style={{
            position: 'absolute',
            width: '200%',
            height: '200%',
            top: '-50%',
            left: '-50%',
            backgroundImage: 'linear-gradient(rgba(0, 245, 160, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 160, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: 'meshMove 20s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 245, 160, 0.3) 0%, transparent 70%)',
            top: '20%',
            left: '60%',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 217, 245, 0.3) 0%, transparent 70%)',
            top: '60%',
            left: '20%',
            animation: 'float 10s ease-in-out infinite reverse',
          }}
        />
      </div>
    );
  }

  if (type === 'aurora') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0f0f23' }}>
        <div
          style={{
            position: 'absolute',
            width: '150%',
            height: '150%',
            top: '-25%',
            left: '-25%',
            background: 'radial-gradient(ellipse at 20% 50%, rgba(168, 85, 247, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 40% 80%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)',
            animation: 'auroraMove 12s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at 60% 30%, rgba(236, 72, 153, 0.3) 0%, transparent 40%), radial-gradient(ellipse at 30% 70%, rgba(139, 92, 246, 0.3) 0%, transparent 40%)',
            animation: 'auroraMove 15s ease-in-out infinite reverse',
          }}
        />
      </div>
    );
  }

  if (type === 'particles') {
    return (
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, background: '#1a1a2e' }}
      />
    );
  }

  return null;
};

const LoginDemo: React.FC = () => {
  const [currentStyle, setCurrentStyle] = useState<string>('darkTech');
  const style = styles[currentStyle];
  const isDark = ['darkTech', 'glassmorphism', 'deepBlue', 'meshAnimation', 'aurora', 'particles'].includes(currentStyle);

  const cssKeyframes = `
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes meshMove {
      0% { transform: translate(0, 0) rotate(0deg); }
      100% { transform: translate(50px, 50px) rotate(5deg); }
    }
    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(30px, -30px) scale(1.1); }
    }
    @keyframes auroraMove {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      33% { transform: translate(30px, -20px) rotate(5deg); }
      66% { transform: translate(-20px, 30px) rotate(-5deg); }
    }
  `;

  const iconColor = isDark ? 'rgba(255,255,255,0.5)' : '#999';
  const logoBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0';
  const inputStyle: React.CSSProperties = {
    background: style.inputBg,
    border: '1px solid ' + style.inputBorder,
    borderRadius: 8,
    color: style.textColor,
    height: 48
  };

  return (
    <React.Fragment>
      <style>{cssKeyframes}</style>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div style={{ 
          width: 280, 
          padding: 24, 
          background: 'var(--custom-card-bg)', 
          borderRight: '1px solid var(--custom-border)',
          overflowY: 'auto',
          zIndex: 10
        }}>
          <Title level={4} style={{ marginBottom: 24 }}>选择背景风格</Title>
          <Radio.Group 
            value={currentStyle} 
            onChange={(e) => setCurrentStyle(e.target.value)}
            style={{ width: '100%' }}
          >
       <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(styleNames).map(([key, name]) => (
                <Radio.Button 
                  key={key} 
                  value={key}
                  style={{ 
                    width: '100%', 
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 8,
                    marginBottom: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: styles[key].background,
                      border: '1px solid #ddd'
                    }} />
                    {name}
                  </div>
                </Radio.Button>
              ))}
            </Space>
          </Radio.Group>
          
          <div style={{ marginTop: 32, padding: 16, background: 'var(--custom-hover-bg)', borderRadius: 8 }}>
            <Text strong>当前选择: </Text>
            <Text>{styleNames[currentStyle]}</Text>
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          background: style.hasAnimation ? 'transparent' : style.background,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          transition: 'background 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {style.hasAnimation && style.animationType && (
            <AnimatedBackground type={style.animationType} />
          )}
          
          <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: logoBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 24,
                backdropFilter: 'blur(10px)'
              }}>
                🤖
              </div>
              <Title level={2} style={{ 
                color: style.textColor, 
                margin: 0,
                transition: 'color 0.3s ease'
              }}>
                欢迎回来
              </Title>
              <Text style={{ 
                color: style.subtitleColor,
                fontSize: 16,
                transition: 'color 0.3s ease'
              }}>
                登录您的账户以继续
              </Text>
            </div>

            <Card style={{
              background: style.cardBg,
              border: style.cardBorder,
              borderRadius: 16,
              backdropFilter: style.blur || 'blur(10px)',
              boxShadow: isDark 
                ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
                : '0 4px 24px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.3s ease'
            }}>
              <Form layout="vertical">
                <Form.Item>
                  <Input
                    prefix={<UserOutlined style={{ color: iconColor }} />}
                    placeholder="用户名"
                    size="large"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item>
                  <Input.Password
                    prefix={<LockOutlined style={{ color: iconColor }} />}
                    placeholder="密码"
                    size="large"
                    style={inputStyle}
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                  <Button
                    type="primary"
                    block
                    size="large"
                    style={{
                      height: 48,
                      borderRadius: 8,
                      background: style.buttonBg,
                      border: 'none',
                      fontWeight: 500,
                      fontSize: 16
                    }}
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <div style={{ 
              textAlign: 'center', 
              marginTop: 24,
              color: style.subtitleColor,
              transition: 'color 0.3s ease'
            }}>
              © 2025 MesaLogo. All Rights Reserved.
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

export default LoginDemo;
