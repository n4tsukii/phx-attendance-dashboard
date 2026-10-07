'use client';
import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {BarChart,LineChart,HeatmapChart,SankeyChart,ScatterChart,PieChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,VisualMapComponent,DataZoomComponent,AriaComponent,MarkLineComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import type {EChartsOption} from 'echarts';
echarts.use([BarChart,LineChart,HeatmapChart,SankeyChart,ScatterChart,PieChart,GridComponent,TooltipComponent,LegendComponent,VisualMapComponent,DataZoomComponent,AriaComponent,MarkLineComponent,SVGRenderer]);
export default function AnalysisChart({option,height=320,label,onSelect}:{option:EChartsOption;height?:number;label:string;onSelect?:(index:number,name:string)=>void}){
 const element=useRef<HTMLDivElement>(null),chart=useRef<echarts.EChartsType|null>(null),handler=useRef(onSelect);handler.current=onSelect;
 useEffect(()=>{if(!element.current)return;const instance=echarts.init(element.current,undefined,{renderer:'svg'});chart.current=instance;
  instance.on('click',(event)=>handler.current?.(event.dataIndex,event.name));
  const observer=new ResizeObserver(()=>instance.resize());observer.observe(element.current);
  return()=>{observer.disconnect();instance.dispose();chart.current=null;};},[]);
 useEffect(()=>{chart.current?.setOption({animation:false,textStyle:{fontFamily:'Segoe UI, Arial',fontSize:12,color:'#6d7683'},tooltip:{renderMode:'richText',confine:true},...option},true);},[option]);
 return <div className="chart-surface" ref={element} role="img" aria-label={label} style={{height}}/>;
}
