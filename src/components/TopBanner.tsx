const LAUNCH = Date.parse("2026-10-21T00:00:00Z");
const URL = "https://robotics-interview-dashboard.onrender.com/";

const TopBanner = () => {
  const live = Date.now() >= LAUNCH;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-center px-4 text-center text-xs sm:text-sm font-medium bg-yellow-400 text-yellow-950">
      {live ? (
        <span>
          One dashboard. Every robotics need. It's live now—check it out:{" "}
          <a href={URL} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
            {URL}
          </a>
        </span>
      ) : (
        <span>All your robotics tools, finally unified. Going public on 10/21 at midnight UTC!</span>
      )}
    </div>
  );
};

export default TopBanner;
