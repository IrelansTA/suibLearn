interface Props {
  message: string;
}

export default function LoadingProgress({ message }: Props) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-[#2a2a2a] border-t-[#e74c3c] rounded-full animate-spin mx-auto mb-4" />
      <p className="text-lg text-[#a0a0a0]">{message}</p>
      <p className="text-sm text-[#666] mt-2">请耐心等待，首次处理可能需要一些时间</p>
    </div>
  );
}
