

import  NoUniformColObj  from "@/model/non-uniform-col-obj";
import store, { GlobalState, ViewChangeLineChartObj } from "@/store";
import * as d3 from 'd3';
import { Commit, ActionContext, ActionHandler } from 'vuex'
import axios from "axios";
import { formatRenderDataForViewChange, formatNonPowDataForViewChange } from '../helper/format-data';
class InteractionInfo {
    type: string
    showInfo: Array<boolean>
    timeRange: Array<number>
    width: number
    level: number
    constructor(type: string) {
        this.type = type;
        this.showInfo = [];
        this.timeRange = [];
        this.width = 0;
        this.level = 0;
    }
    setShowInfo(showInfo: Array<boolean>) {
        this.showInfo = showInfo;
    }
    setRangeW(timeRange: Array<number>, width: number, level: number) {
        this.timeRange = [timeRange[0], timeRange[1]];
        this.width = width;
        this.level = level;
    }

}
let interactionStack: Array<InteractionInfo> = [];

async function get(url: string) {
    url = 'postgres' + url;
    //const loading = openLoading();
    const { data } = await axios.get(url);
    //loading.close();
    return data;
}

export function drawViewChangeLineChart(lineChartObj: ViewChangeLineChartObj, line1:any) {
    let realTimeStampRange: Array<number> = [];
    let nodeIndexRange: Array<number> = []
    let rowNumber = 131072;
    // realTimeStampRange = [lineChartObj.startTime,lineChartObj.endTime];
    realTimeStampRange = [0, rowNumber];
    nodeIndexRange = [lineChartObj.timeRange[0],lineChartObj.timeRange[1]];
    
    let isInit = false;
    let isResizing = false;
    let isRebacking = false;
    let interactiveInfo = {
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        isMouseDown: false,
        isMove: false,
    };
    const pading = { top: 20, bottom: 80, left: 60, right: 20 };
    const svg = d3.select("#content-container").append("svg");
    svg
        .attr("width", lineChartObj.width + pading.left + pading.right)
        .attr("height", lineChartObj.height + pading.top + pading.bottom)
        .attr("transform", `translate(${lineChartObj.x},${lineChartObj.y})`)
        .style("background-color", "#fff");
    const foreignId = `foreign${lineChartObj.width + Math.random()}`;
    const foreigG = svg.append("g").attr("transfrom", `translate(${pading.left},${pading.top})`)
    let foreignObj: any = foreigG.append("foreignObject").attr("id", foreignId).attr("x", pading.left).attr("y", pading.top).attr('width', lineChartObj.width).attr('height', lineChartObj.height);
    const canvas = document.createElement("canvas");
    (canvas as any).__data__ = {}
    document.getElementById(foreignId)?.appendChild(canvas);
    canvas.width = lineChartObj.width;
    canvas.height = lineChartObj.height;
    let ctx = canvas.getContext("2d");

    const indexToTimeStampScale = d3.scaleLinear().domain([nodeIndexRange[0], nodeIndexRange[1]]).range([realTimeStampRange[0], realTimeStampRange[1]]);
    const xScale: any = d3.scaleLinear().domain([0, lineChartObj.width]).range([0, lineChartObj.width]);
    // let showTimeXScale: any = d3.scaleTime().domain([new Date(realTimeStampRange[0]), new Date(realTimeStampRange[1])]).range([0, lineChartObj.width]);
    let showTimeXScale: any = d3.scaleLinear().domain([0, rowNumber]).range([0, lineChartObj.width]);
    let yScale: any = d3.scaleLinear().domain([-1000, 1000]).range([lineChartObj.height, 0]);
    let xReScale = d3.scaleLinear().domain([0, lineChartObj.width]).range([0, rowNumber - 1]);
    // let showXTimeScale: any = d3.scaleTime().domain([0,65536]).range([0, lineChartObj.width]);
    let showXTimeScale: any = d3.scaleLinear().domain([0,rowNumber]).range([0, lineChartObj.width]);

    let zoomAxis = d3.axisBottom(showTimeXScale);
    let yAxis = d3.axisLeft(yScale)
    let xAxis = d3.axisBottom(showXTimeScale)
    const timeBrushObj = d3.brushX().extent([[0, 10], [lineChartObj.width, 40]]);

    timeBrushObj.on("end", brushed);
    timeBrushObj.on("start", () => {
        console.log("start")
    })
    const timeBoxG = svg.append("g").attr("transform", `translate(${pading.left},${pading.top + 50 + lineChartObj.height - 20})`).call(timeBrushObj).call(timeBrushObj.move, [0, lineChartObj.width]);
    let zoomAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${lineChartObj.height + pading.top + 50})`).attr("class", 'x axis').call(zoomAxis)
    let xAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${lineChartObj.height + pading.top})`).attr("class", 'x axis').call(xAxis)
    let yAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${pading.top})`).attr("class", 'y axis').call(yAxis);


    function updateCanvasWidth() {
        //@ts-ignore
        canvas.style.width = lineChartObj.width;
        svg
            .attr("width", lineChartObj.width + pading.left + pading.right)
            .attr("height", lineChartObj.height + pading.top + pading.bottom)
        foreignObj.attr("width", lineChartObj.width);
        xScale.domain([0, lineChartObj.width]).range([0, lineChartObj.width]);
        // showTimeXScale.domain([new Date(realTimeStampRange[0]), new Date(realTimeStampRange[1])]).range([0, lineChartObj.width]);
        showXTimeScale = d3.scaleTime().domain([new Date(Math.floor(indexToTimeStampScale(0))), new Date(Math.floor(indexToTimeStampScale(rowNumber)))]).range([0, lineChartObj.width]);

        //showTimeXScale.range([0, lineChartObj.width]);
        if (zoomAxisG != null) {
            zoomAxisG.remove();
            zoomAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${lineChartObj.height + pading.top + 50})`).attr("class", 'x axis').call(zoomAxis)
        }
        timeBrushObj.extent([[0, 10], [lineChartObj.width, 40]]);
        timeBrushObj.on("end", brushed);
        timeBrushObj.on("start", () => {
            console.log("start")
        })
        // const tempReScale=d3.scaleLinear().domain([0, lineChartObj.dataManager.realDataRowNum - 1]).range([0,lineChartObj.width]);

        // timeBoxG.call(timeBrushObj).call(timeBrushObj.move, [tempReScale(lineChartObj.timeRange[0]), tempReScale(lineChartObj.timeRange[1])]);
        ctx = canvas.getContext("2d");
    }

    function draw(nonUniformColObjs?: any) {
        canvas.width = lineChartObj.width;
        // yScale = d3.scaleLinear().domain([lineChartObj.data.minv, lineChartObj.data.maxv]).range([lineChartObj.height, 0]);
        yScale = d3.scaleLinear().domain([lineChartObj.minV, lineChartObj.maxV]).range([lineChartObj.height, 0]);
        // yScale = d3.scaleLinear().domain([-finalValue, finalValue]).range([lineChartObj.height, 0]);
        yAxis = d3.axisLeft(yScale)
        if (yAxisG !== null && yAxisG !== undefined) {
            yAxisG.remove();
        }
        yAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${pading.top})`).attr("class", 'y axis').call(yAxis);

        // showXTimeScale = d3.scaleTime().domain([new Date(Math.floor(indexToTimeStampScale(lineChartObj.timeRange[0]))), new Date(Math.floor(indexToTimeStampScale(lineChartObj.timeRange[1])))]).range([0, lineChartObj.width]);
        showXTimeScale = d3.scaleLinear().domain([0, rowNumber]).range([0, lineChartObj.width]);
        xAxis = d3.axisBottom(showXTimeScale);
        if (xAxisG !== null && xAxisG !== undefined) {
            xAxisG.remove();
        }
        xAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${lineChartObj.height + pading.top})`).attr("class", 'x axis').call(xAxis)

        if (foreignObj == null && nonUniformColObjs) {
            foreignObj = svg.append("foreignObject")
                .attr("id", "foreign")
                .attr('x', pading.left)
                .attr('y', pading.top)
                .attr('width', lineChartObj.width)
                .attr('height', lineChartObj.height);
            const canvas = document.createElement("canvas");
            document.getElementById("foreign")?.appendChild(canvas);
            canvas.width = lineChartObj.width;
            canvas.height = lineChartObj.height;
            ctx = canvas.getContext("2d");
        }

        nonUniformColObjs = nonUniformColObjs[0];
        if (nonUniformColObjs && ctx) {
            ctx.clearRect(0, 0, lineChartObj.width, lineChartObj.height);
            ctx.beginPath();
            ctx.strokeStyle = "steelblue"
            let interval = (nonUniformColObjs[0].end_time - nonUniformColObjs[0].start_time)/3;
            for (let i = 0; i < nonUniformColObjs.length; i++) {
                ctx.moveTo(showXTimeScale(nonUniformColObjs[i].start_time), yScale(nonUniformColObjs[i].st_v));
                ctx.lineTo(showXTimeScale(nonUniformColObjs[i].start_time + interval*2), yScale(nonUniformColObjs[i].min));
                ctx.moveTo(showXTimeScale(nonUniformColObjs[i].start_time + interval*2), yScale(nonUniformColObjs[i].min));
                ctx.lineTo(showXTimeScale(nonUniformColObjs[i].start_time + interval*3), yScale(nonUniformColObjs[i].max));
                ctx.moveTo(showXTimeScale(nonUniformColObjs[i].start_time + interval*3), yScale(nonUniformColObjs[i].max));
                ctx.lineTo(showXTimeScale(nonUniformColObjs[i].end_time), yScale(nonUniformColObjs[i].et_v));
                if (i <= nonUniformColObjs.length - 2) {
                    ctx.moveTo(showXTimeScale(nonUniformColObjs[i].end_time), yScale(nonUniformColObjs[i].et_v));
                    ctx.lineTo(showXTimeScale(nonUniformColObjs[i + 1].start_time), yScale(nonUniformColObjs[i + 1].st_v));
                }
            }
            ctx.stroke();
        } else {
            console.log("error")
        }

    }

    // function draw(nonUniformColObjs?: Array<NoUniformColObj>, finalValue?:any, transform_symbol?:string, lenOfLines?:number) {
    //     canvas.width = lineChartObj.width;
    //     // yScale = d3.scaleLinear().domain([lineChartObj.data.minv, lineChartObj.data.maxv]).range([lineChartObj.height, 0]);
    //     yScale = d3.scaleLinear().domain([-2000, 2000]).range([lineChartObj.height, 0]);
    //     // yScale = d3.scaleLinear().domain([-finalValue, finalValue]).range([lineChartObj.height, 0]);
    //     yAxis = d3.axisLeft(yScale)
    //     if (yAxisG !== null && yAxisG !== undefined) {
    //         yAxisG.remove();
    //     }
    //     yAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${pading.top})`).attr("class", 'y axis').call(yAxis);

    //     showXTimeScale = d3.scaleTime().domain([new Date(Math.floor(indexToTimeStampScale(lineChartObj.timeRange[0]))), new Date(Math.floor(indexToTimeStampScale(lineChartObj.timeRange[1])))]).range([0, lineChartObj.width]);
    //     xAxis = d3.axisBottom(showXTimeScale);
    //     if (xAxisG !== null && xAxisG !== undefined) {
    //         xAxisG.remove();
    //     }
    //     xAxisG = svg.append("g").attr('style', 'user-select:none').attr("transform", `translate(${pading.left},${lineChartObj.height + pading.top})`).attr("class", 'x axis').call(xAxis)

    //     if (foreignObj == null && nonUniformColObjs) {
    //         foreignObj = svg.append("foreignObject")
    //             .attr("id", "foreign")
    //             .attr('x', pading.left)
    //             .attr('y', pading.top)
    //             .attr('width', lineChartObj.width)
    //             .attr('height', lineChartObj.height);
    //         const canvas = document.createElement("canvas");
    //         document.getElementById("foreign")?.appendChild(canvas);
    //         canvas.width = lineChartObj.width;
    //         canvas.height = lineChartObj.height;
    //         ctx = canvas.getContext("2d");
    //     }

    //     if (nonUniformColObjs && ctx) {
    //         formatNonPowDataForViewChange(nonUniformColObjs,lineChartObj.width,lineChartObj.maxLen,null)
    //         // console.log(nonUniformColObjs);
    //         ctx.clearRect(0, 0, lineChartObj.width, lineChartObj.height);
    //         ctx.beginPath();
    //         ctx.strokeStyle = "steelblue"
            
    //         for (let i = 0; i < nonUniformColObjs.length; i++) {
    //             if (nonUniformColObjs[i].isMis) {
    //                 continue
    //             }
    //             if (nonUniformColObjs[i].minVTimeRange[0] < nonUniformColObjs[i].maxVTimeRange[0]) {
    //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].vRange[0]));
    //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].vRange[1]));
    //             } else {
    //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].vRange[1]));
    //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].vRange[0]));
    //             }
    //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //             }
    //         }

    //         const stack = [];
    //         for (let i = 0; i < nonUniformColObjs.length - 1; i++) {
    //             if (!nonUniformColObjs[i].isMis && nonUniformColObjs[i + 1].isMis) {
    //                 stack.push(nonUniformColObjs[i]);
    //                 for (let j = i + 1; j < nonUniformColObjs.length; j++) {
    //                     if (nonUniformColObjs[j - 1].isMis && !nonUniformColObjs[j].isMis) {
    //                         const co = stack.pop()
    //                         if (nonUniformColObjs[j].startV === undefined || co?.endV === undefined) {
    //                             console.error("error nonUniform");
    //                         }
    //                         ctx.moveTo(co!.positionInfo.endX, yScale(co!.endV));
    //                         if (nonUniformColObjs[j].startV !== undefined) {
    //                             ctx.lineTo(nonUniformColObjs[j].positionInfo.startX, yScale(nonUniformColObjs[j].startV!))
    //                         } else {
    //                             ctx.lineTo(nonUniformColObjs[j].positionInfo.minX, yScale((nonUniformColObjs[j].vRange[0] + nonUniformColObjs[j].vRange[1]) / 2))
    //                         }

    //                     }
    //                 }
    //             }
    //         }
    //         ctx.stroke();
    //     } else {
    //         console.log("error")
    //     }

    //     // if (nonUniformColObjs && ctx) {
    //     //     formatNonPowDataForViewChange(nonUniformColObjs,lineChartObj.width,lineChartObj.maxLen,null)
    //     //     // console.log(nonUniformColObjs);
    //     //     ctx.clearRect(0, 0, lineChartObj.width, lineChartObj.height);
    //     //     ctx.beginPath();

    //     //     ctx.strokeStyle = 'steelblue';
    //     //     if(transform_symbol === '+'){
    //     //         for(let i=0; i<nonUniformColObjs.length; i++){
    //     //             if(nonUniformColObjs[i].addMin[0] < nonUniformColObjs[i].addMax[0]){
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].addMin[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].addMax[1]));
    //     //                 // ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(i*2));
    //     //                 // ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(i*2));
    //     //             }
    //     //             else{
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].addMax[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].addMin[1]));
    //     //             }
    //     //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //     //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //     //             }
    //     //             // ctx.moveTo(nonUniformColObjs[i].positionInfo.startX, yScale(nonUniformColObjs[i].addMin));
    //     //             // ctx.lineTo(nonUniformColObjs[i+1].positionInfo.startX, yScale(nonUniformColObjs[i+1].addMin));
    //     //         }
    //     //     }
    //     //     else if(transform_symbol === '-'){
    //     //         for(let i=0; i<nonUniformColObjs.length; i++){
    //     //             if(nonUniformColObjs[i].subMin[0] < nonUniformColObjs[i].subMax[0]){
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].subMin[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].subMax[1]));
    //     //             }
    //     //             else{
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].subMax[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].subMin[1]));
    //     //             }
    //     //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //     //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //     //             }
    //     //             // ctx.moveTo(nonUniformColObjs[i].positionInfo.startX, yScale(nonUniformColObjs[i].addMin));
    //     //             // ctx.lineTo(nonUniformColObjs[i+1].positionInfo.startX, yScale(nonUniformColObjs[i+1].addMin));
    //     //         }
    //     //     }
    //     //     else if(transform_symbol === '*'){
    //     //         for(let i=0; i<nonUniformColObjs.length; i++){
    //     //             if(nonUniformColObjs[i].multiMin[0] < nonUniformColObjs[i].multiMax[0]){
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].multiMin[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].multiMax[1]));
    //     //             }
    //     //             else{
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].multiMax[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].multiMin[1]));
    //     //             }
    //     //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //     //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //     //             }
    //     //             // ctx.moveTo(nonUniformColObjs[i].positionInfo.startX, yScale(nonUniformColObjs[i].addMin));
    //     //             // ctx.lineTo(nonUniformColObjs[i+1].positionInfo.startX, yScale(nonUniformColObjs[i+1].addMin));
    //     //         }
    //     //     }
    //     //     else if(transform_symbol === '/'){
    //     //         for(let i=0; i<nonUniformColObjs.length; i++){
    //     //             if(nonUniformColObjs[i].divMin[0] < nonUniformColObjs[i].divMax[0]){
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].divMin[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].divMax[1]));
    //     //             }
    //     //             else{
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].divMax[1]));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].divMin[1]));
    //     //             }
    //     //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //     //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //     //             }
    //     //             // ctx.moveTo(nonUniformColObjs[i].positionInfo.startX, yScale(nonUniformColObjs[i].addMin));
    //     //             // ctx.lineTo(nonUniformColObjs[i+1].positionInfo.startX, yScale(nonUniformColObjs[i+1].addMin));
    //     //         }
    //     //     }
    //     //     else if(transform_symbol === 'avg'){
    //     //         for(let i=0; i<nonUniformColObjs.length-1; i++){
    //     //             if(nonUniformColObjs[i].addMin[0] < nonUniformColObjs[i].addMax[0]){
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].addMin[1]/lenOfLines!));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].addMax[1]/lenOfLines!));
    //     //             }
    //     //             else{
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.minX, yScale(nonUniformColObjs[i].addMax[1]/lenOfLines!));
    //     //                 ctx.lineTo(nonUniformColObjs[i].positionInfo.maxX, yScale(nonUniformColObjs[i].addMin[1]/lenOfLines!));
    //     //             }
    //     //             // ctx.moveTo(nonUniformColObjs[i].positionInfo.startX, yScale(nonUniformColObjs[i].average));
    //     //             // ctx.lineTo(nonUniformColObjs[i+1].positionInfo.startX, yScale(nonUniformColObjs[i+1].average)); 
    //     //             if (i <= nonUniformColObjs.length - 2 && nonUniformColObjs[i].endV !== undefined && nonUniformColObjs[i + 1] !== undefined) {
    //     //                 ctx.moveTo(nonUniformColObjs[i].positionInfo.endX, yScale(nonUniformColObjs[i].endV!));
    //     //                 ctx.lineTo(nonUniformColObjs[i + 1].positionInfo.startX, yScale(nonUniformColObjs[i + 1].startV!));
    //     //             }
    //     //         }
    //     //     }
    //     //     ctx.stroke();
    //     //     // savePNG(canvas);
    //     // } else {
    //     //     console.log("error")
    //     // }
        

    // }

    // draw(!lineChartObj.isPow ? lineChartObj.nonUniformColObjs : undefined);

    //@ts-ignore
    async function brushed({ selection }) {
        if (!isInit) {
            isInit = true
            return;
        }
        if (isResizing) {
            isRebacking = false;
            return;
        }
        if (isRebacking) {
            isRebacking = false;
            return
        }

        const timeRange = [Math.floor(xReScale(selection[0])), Math.floor(xReScale(selection[1]))];
        if (timeRange[0] < 0) {
            timeRange[0] = 0;
        }
        if (timeRange[1] > rowNumber) {
            timeRange[1] = rowNumber
        }
        const interInfo = new InteractionInfo("zoom")
        lineChartObj.timeRange[0] = timeRange[0];
        lineChartObj.timeRange[1] = timeRange[1];
        interInfo.setRangeW(lineChartObj.timeRange, lineChartObj.width, lineChartObj.currentLevel);
        interactionStack.push(interInfo);

        console.log("brush....");
        let mode = "compute";
        let type = ""
        let parallel = 0;
        let errorBound = 0;
        
        const combinedUrl = `/line_chart/case1?table_name=${line1[0]}&table_name_others=${line1[1]}&symbol=${line1[2]}&mode=${mode}&width=${lineChartObj.width}&height=${lineChartObj.height}&startTime=${lineChartObj.timeRange[0]}&endTime=${lineChartObj.timeRange[1]}&interact_type=${type}&experiment=${line1[3]}&parallel=${parallel}&errorBound=${errorBound}`;
        const showColumns = await get(combinedUrl);
        draw(showColumns['M4_array']);
    }

    async function resizeW(width: number) {
        isResizing = true;
        const currentLevel = lineChartObj.currentLevel;

        lineChartObj.width = width;
        updateCanvasWidth();

        //@ts-ignore
        canvas.style.width = lineChartObj.width;

        console.log("resize....");
        let mode = "compute";
        let type = ""
        let parallel = 0;
        let errorBound = 0;
        const combinedUrl = `/line_chart/case1?table_name=${line1[0]}&table_name_others=${line1[1]}&symbol=${line1[2]}&mode=${mode}&width=${lineChartObj.width}&height=${lineChartObj.height}&startTime=${lineChartObj.timeRange[0]}&endTime=${lineChartObj.timeRange[1]}&interact_type=${type}&experiment=${line1[3]}&parallel=${parallel}&errorBound=${errorBound}`;
        const showColumns = await get(combinedUrl);
        draw(showColumns['M4_array']);
    }
    let isMouseover = false;
    let startOffsetX = 0;
    const dragRect = svg
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", lineChartObj.height + pading.top + pading.bottom)
        .attr("width", lineChartObj.width + pading.left + pading.right)
        .attr("stroke", "black")
        .attr("stroke-width", 4)
        .attr("fill", "none")
        .on("mouseover", () => {
            document.body.style.cursor = 'ew-resize';
            isMouseover = true;
        })
        .on("mousedown", (e) => {
            if (isMouseover) {
                startOffsetX = e.offsetX;
                interactiveInfo.isMouseDown = true;
            }
        })
        .on("mouseup", () => {
            console.log()
        })
        .on("mousemove", (e) => {
            if (interactiveInfo.isMouseDown) {
                svg.attr("width", lineChartObj.width + pading.right + pading.left + (e.offsetX - startOffsetX));
                dragRect.attr("width", lineChartObj.width + pading.right + pading.left + (e.offsetX - startOffsetX));
            }
        })
        .on("mouseleave", () => {
            if (!interactiveInfo.isMouseDown) {
                document.body.style.cursor = 'default';
            }
        })

    document
        .getElementById("content-container")!
        .addEventListener("mousemove", (e) => {
            if (interactiveInfo.isMouseDown) {
                svg.attr("width", lineChartObj.width + pading.right + pading.left + (e.offsetX - startOffsetX));
                dragRect.attr("width", lineChartObj.width + pading.right + pading.left + (e.offsetX - startOffsetX));
            }
        });

    document
        .getElementById("content-container")!
        .addEventListener("mouseup", (e) => {
            if (interactiveInfo.isMouseDown) {
                interactiveInfo.isMouseDown = false;
                isMouseover = false;
                document.body.style.cursor = 'default';
                let preWidth = lineChartObj.width;
                lineChartObj.width = lineChartObj.width + (e.offsetX - startOffsetX);
                if (lineChartObj.width === preWidth) {
                    return
                }
                const interInfo = new InteractionInfo("resize")
                interInfo.setRangeW(lineChartObj.timeRange, lineChartObj.width, lineChartObj.currentLevel);
                interactionStack.push(interInfo);
                resizeW(lineChartObj.width)
            }
        });

    return draw
}

function computeMinMax(columInfo: Array<NoUniformColObj>) {
    let min = Infinity;
    let max = -Infinity;

    for (let j = 0; j < columInfo.length; j++) {
        if (columInfo[j].vRange[0] < min) {
            min = columInfo[j].vRange[0];
        }

        if (columInfo[j].vRange[1] > max) {
            max = columInfo[j].vRange[1];
        }

    }

    return {
        min,
        max
    }
}

function savePNG(canvas: any) {
    const imgURL = canvas.toDataURL("./image/png");
    const dlLink = document.createElement("a")
    dlLink.download = `1b_zoom_init`
    dlLink.href = imgURL
    dlLink.dataset.downloadurl = ["./image/png", dlLink.download, dlLink.href].join(":")
    document.body.appendChild(dlLink)
    dlLink.click()
    document.body.removeChild(dlLink)
}