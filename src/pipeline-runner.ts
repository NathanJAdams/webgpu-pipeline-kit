import { WPKPipeline, WPKPipelineDetailOptions, WPKPipelineOptions } from './pipeline';
import { pipelineFuncs } from './pipeline-utils';
import { NonEmptyArray } from './utils';
import { viewsFuncFactory } from './views';

export type WPKPipelineRunner = {
    invoke: (options: WPKPipelineOptions) => Promise<void>;
};

export const pipelineRunnerFactory = {
  of: async (canvas: HTMLCanvasElement, ...pipelines: NonEmptyArray<WPKPipeline<any, any, boolean, boolean, boolean>>): Promise<WPKPipelineRunner> => {
    const context = pipelineFuncs.getContext(canvas);
    const device = await pipelineFuncs.getDevice();
    const format = pipelineFuncs.getFormat();
    const alphaMode = 'opaque';
    context.configure({
      alphaMode,
      device,
      format,
    });
    const getViews = viewsFuncFactory.of(canvas, context, device, format);
    return {
      // async not strictly needed, but useful to prevent changing signature in case future changes need it
      async invoke(options) {
        const encoder = device.createCommandEncoder({
          label: 'command-encoder',
        });
        const { queue } = device;
        const detailOptions: WPKPipelineDetailOptions = {
          isAntiAliased: options.isAntiAliased,
          textureFormat: format,
        };
        const { clear, isAntiAliased } = options;
        const clearValue = [clear.r, clear.g, clear.b, clear.a || 1];
        const views = getViews(isAntiAliased);
        const pipelineDetails = pipelines.map((pipeline) => pipeline.pipelineDetail(device, queue, encoder, detailOptions));
        const validPipelines = pipelineDetails.filter((pipelineDetail) => pipelineDetail.isValid);
        for (const pipelineDetail of validPipelines) {
          const { compute } = pipelineDetail;
          if (compute !== undefined) {
            const computePass = encoder.beginComputePass();
            for (const computeEntry of compute) {
              const { bindGroups, pipeline, workGroupSizeFunc } = computeEntry;
              const workGroupSize = workGroupSizeFunc();
              computePass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                computePass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              computePass.dispatchWorkgroups(workGroupSize.x, workGroupSize.y, workGroupSize.z);
            }
            computePass.end();
          }
          const { render } = pipelineDetail;
          if (render !== undefined) {
            const renderPass = encoder.beginRenderPass({
              label: 'render-encoder',
              colorAttachments: [{
                ...views,
                clearValue,
                loadOp: 'clear',
                storeOp: 'store'
              }]
            });
            for (const renderEntry of render) {
              const { bindGroups, pipeline, indices, vertexBuffers, drawCountsFunc } = renderEntry;
              const drawCounts = drawCountsFunc();
              renderPass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                renderPass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              renderPass.setIndexBuffer(indices.buffer, indices.format);
              for (const [slot, vertexBuffer] of vertexBuffers.entries()) {
                renderPass.setVertexBuffer(slot, vertexBuffer);
              }
              renderPass.drawIndexed(drawCounts.indexCount, drawCounts.instanceCount);
            }
            renderPass.end();
          }
        }
        device.queue.submit([encoder.finish()]);
      },
    };
  },
};
