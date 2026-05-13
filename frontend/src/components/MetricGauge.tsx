import React from 'react';
import ReactECharts from 'echarts-for-react';

const MetricGauge = ({ value, title, color = '#1677ff', max = 100 }) => {
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        radius: '90%',
        pointer: {
          show: false
        },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            color: color
          }
        },
        axisLine: {
          lineStyle: {
            width: 8,
            color: [[1, 'var(--custom-border)']]
          }
        },
        splitLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        },
        data: [
          {
            value: value,
            name: title,
            title: {
              offsetCenter: [0, '120%'],
              fontSize: 12,
              color: 'var(--custom-text-secondary)'
            },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, '0%'],
              fontSize: 24,
              fontWeight: 'bold',
              color: color,
              formatter: '{value}'
            }
          }
        ],
        detail: {
          show: true
        }
      }
    ]
  };

  return (
    <ReactECharts 
      option={option} 
      style={{ height: '140px', width: '120px' }} 
      opts={{ renderer: 'svg' }}
    />
  );
};

export default MetricGauge;
