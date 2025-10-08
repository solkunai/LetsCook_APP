import SaucePointsBadge from '../SaucePointsBadge';

export default function SaucePointsBadgeExample() {
  return (
    <div className="p-4 space-y-4">
      <SaucePointsBadge points={50} />
      <SaucePointsBadge points={250} />
      <SaucePointsBadge points={750} />
      <SaucePointsBadge points={1500} />
    </div>
  );
}
