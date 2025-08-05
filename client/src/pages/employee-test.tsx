import { useLocation } from 'wouter';

export default function EmployeeTest() {
  const [location] = useLocation();
  
  console.log("Current location:", location);
  console.log("Employee Test component rendered");
  
  return (
    <div className="container mx-auto p-6 bg-green-50 min-h-screen">
      <h1 className="text-4xl font-bold text-green-600 mb-4">🎉 Employee Management Page Working!</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <p className="text-lg mb-4">Current URL: <code className="bg-gray-100 px-2 py-1 rounded">{location}</code></p>
        <p className="text-gray-700 mb-2">This is the dedicated employee management page.</p>
        <p className="text-gray-700 mb-4">If you can see this GREEN background, the routing is working correctly!</p>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>Success!</strong> The Employee Management route is functioning properly.
        </div>
        <p className="text-sm text-gray-600">Time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}