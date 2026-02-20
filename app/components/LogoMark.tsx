import Image from "next/image";

export default function LogoMark(props: { className?: string }) {
  const { className } = props;

  return (
    <Image
      src="/logo.png"
      alt="syllab.ai"
      width={200}
      height={80}
      className={className}
      priority
    />
  );
}
